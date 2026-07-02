import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { MailService } from "../src/mail/mail.service";
import { PrismaService } from "../src/prisma/prisma.service";

/** Stub de MailService que captura los tokens enviados por email. */
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

  it("registra un usuario y envía email de verificación", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ name: "Ana", email: EMAIL, password: PASSWORD })
      .expect(201);
    expect(res.body.user.email).toBe(EMAIL);
    expect(res.body.user.emailVerified).toBe(false);
    expect(mail.verificationTokens.get(EMAIL)).toBeTruthy();
  });

  it("rechaza el registro duplicado", async () => {
    await request(app.getHttpServer())
      .post("/auth/register")
      .send({ name: "Ana", email: EMAIL, password: PASSWORD })
      .expect(409);
  });

  it("no deja iniciar sesión sin verificar el email", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: EMAIL, password: PASSWORD })
      .expect(403);
    expect(res.body.code).toBe("EMAIL_NOT_VERIFIED");
  });

  it("verifica el email con el token y rechaza reutilizarlo", async () => {
    const token = mail.verificationTokens.get(EMAIL)!;
    await request(app.getHttpServer()).post("/auth/verify-email").send({ token }).expect(200);
    await request(app.getHttpServer()).post("/auth/verify-email").send({ token }).expect(400);
  });

  it("rechaza credenciales incorrectas", async () => {
    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: EMAIL, password: "incorrecta99" })
      .expect(401);
  });

  let refreshToken: string;

  it("inicia sesión, devuelve cookies y accede a /auth/me", async () => {
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

  it("rota el refresh token y detecta la reutilización del antiguo", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Cookie", `refresh_token=${refreshToken}`)
      .expect(200);
    const jar = cookiesOf(res);
    expect(jar["refresh_token"]).toBeTruthy();
    expect(jar["refresh_token"]).not.toBe(refreshToken);

    // Reutilizar el token antiguo (ya rotado) debe fallar y revocar todo
    await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Cookie", `refresh_token=${refreshToken}`)
      .expect(401);

    // Y el nuevo también queda revocado por seguridad
    await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Cookie", `refresh_token=${jar["refresh_token"]}`)
      .expect(401);
  });

  it("restablece la contraseña por email y revoca las sesiones", async () => {
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

  it("forgot-password responde ok aunque el email no exista (sin enumeración)", async () => {
    await request(app.getHttpServer())
      .post("/auth/forgot-password")
      .send({ email: "noexiste@test.local" })
      .expect(200);
  });

  it("rechaza tokens de verificación caducados", async () => {
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
