import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { MailService } from "../src/mail/mail.service";
import { PrismaService } from "../src/prisma/prisma.service";

/** MailService stub that captures the tokens sent by email. */
class MailStub {
  verificationTokens = new Map<string, string>();
  resetTokens = new Map<string, string>();

  async sendVerificationEmail(to: string, _name: string, token: string) {
    this.verificationTokens.set(to, token);
  }
  async sendPasswordResetEmail(to: string, _name: string, token: string) {
    this.resetTokens.set(to, token);
  }
}

const EMAIL = "ana.e2e@test.local";
const PASSWORD = "superSecreta1";
const NEW_PASSWORD = "otraSecreta2";

function cookiesOf(res: request.Response): Record<string, string> {
  const raw = (res.headers["set-cookie"] as unknown as string[]) ?? [];
  const jar: Record<string, string> = {};
  for (const line of raw) {
    const [pair] = line.split(";");
    const [name, ...rest] = pair!.split("=");
    jar[name!] = rest.join("=");
  }
  return jar;
}

describe("Auth (e2e)", () => {
  let app: INestApplication;
  let mail: MailStub;
  let prisma: PrismaService;

  beforeAll(async () => {
    mail = new MailStub();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue(mail)
      .compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.user.deleteMany({ where: { email: { endsWith: "@test.local" } } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: "@test.local" } } });
    await app.close();
  });

  it("registers a user and sends a verification email", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ name: "Ana", email: EMAIL, password: PASSWORD })
      .expect(201);
    expect(res.body.user.email).toBe(EMAIL);
    expect(res.body.user.emailVerified).toBe(false);
    expect(mail.verificationTokens.get(EMAIL)).toBeTruthy();
  });

  it("rejects duplicate registration", async () => {
    await request(app.getHttpServer())
      .post("/auth/register")
      .send({ name: "Ana", email: EMAIL, password: PASSWORD })
      .expect(409);
  });

  it("blocks login until the email is verified", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: EMAIL, password: PASSWORD })
      .expect(403);
    expect(res.body.code).toBe("EMAIL_NOT_VERIFIED");
  });

  it("verifies the email with the token and rejects reusing it", async () => {
    const token = mail.verificationTokens.get(EMAIL)!;
    await request(app.getHttpServer()).post("/auth/verify-email").send({ token }).expect(200);
    await request(app.getHttpServer()).post("/auth/verify-email").send({ token }).expect(400);
  });

  it("rejects incorrect credentials", async () => {
    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: EMAIL, password: "incorrecta99" })
      .expect(401);
  });

  let refreshToken: string;

  it("logs in, returns cookies and accesses /auth/me", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: EMAIL, password: PASSWORD })
      .expect(200);
    const jar = cookiesOf(res);
    expect(jar["access_token"]).toBeTruthy();
    expect(jar["refresh_token"]).toBeTruthy();
    refreshToken = jar["refresh_token"]!;

    const me = await request(app.getHttpServer())
      .get("/auth/me")
      .set("Cookie", `access_token=${jar["access_token"]}`)
      .expect(200);
    expect(me.body.user.email).toBe(EMAIL);
    expect(me.body.user.emailVerified).toBe(true);
  });

  it("rotates the refresh token and detects reuse of the old one", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Cookie", `refresh_token=${refreshToken}`)
      .expect(200);
    const jar = cookiesOf(res);
    expect(jar["refresh_token"]).toBeTruthy();
    expect(jar["refresh_token"]).not.toBe(refreshToken);

    // Reusing the old (already-rotated) token must fail and revoke everything
    await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Cookie", `refresh_token=${refreshToken}`)
      .expect(401);

    // And the new one is revoked too, for safety
    await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Cookie", `refresh_token=${jar["refresh_token"]}`)
      .expect(401);
  });

  it("resets the password via email and revokes the sessions", async () => {
    await request(app.getHttpServer()).post("/auth/forgot-password").send({ email: EMAIL }).expect(200);
    const token = mail.resetTokens.get(EMAIL)!;
    expect(token).toBeTruthy();

    await request(app.getHttpServer())
      .post("/auth/reset-password")
      .send({ token, password: NEW_PASSWORD })
      .expect(200);

    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: EMAIL, password: PASSWORD })
      .expect(401);
    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: EMAIL, password: NEW_PASSWORD })
      .expect(200);
  });

  it("forgot-password responds ok even if the email doesn't exist (no enumeration)", async () => {
    await request(app.getHttpServer())
      .post("/auth/forgot-password")
      .send({ email: "noexiste@test.local" })
      .expect(200);
  });

  it("rejects expired verification tokens", async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
    const { createHash } = await import("crypto");
    const raw = "token-caducado-e2e";
    await prisma.verificationToken.create({
      data: {
        userId: user.id,
        type: "PASSWORD_RESET",
        tokenHash: createHash("sha256").update(raw).digest("hex"),
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    await request(app.getHttpServer())
      .post("/auth/reset-password")
      .send({ token: raw, password: NEW_PASSWORD })
      .expect(400);
  });
});
