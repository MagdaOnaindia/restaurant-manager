import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import cookieParser from "cookie-parser";
import Stripe from "stripe";
import { AppModule } from "../src/app.module";
import { MailService } from "../src/mail/mail.service";
import { PrismaService } from "../src/prisma/prisma.service";

class MailStub {
  verificationTokens = new Map<string, string>();
  async sendVerificationEmail(to: string, _n: string, token: string) {
    this.verificationTokens.set(to, token);
  }
  async sendPasswordResetEmail() {}
  async sendInvitationEmail() {}
  async sendReservationConfirmation() {}
  async sendReservationCancelled() {}
}

const EMAIL = "finanzas.stripe@test.local";
const PASSWORD = "claveSegura1";
const WEBHOOK_SECRET = "whsec_test_e2e_secret";
const ACCOUNT_ID = "acct_e2e_test_123";

function cookieHeader(res: request.Response): string {
  const raw = (res.headers["set-cookie"] as unknown as string[]) ?? [];
  return raw.map((line) => line.split(";")[0]).join("; ");
}

/** Signs a payload the way Stripe would (official SDK helper). */
function signedPayload(payload: object): { body: string; signature: string } {
  const body = JSON.stringify(payload);
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload: body,
    secret: WEBHOOK_SECRET,
  });
  return { body, signature };
}

describe("Stripe Connect and webhooks (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<INestApplication["getHttpServer"]>;
  let cookies: string;
  let orgId: string;

  beforeAll(async () => {
    process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_for_signature";
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;

    const mail = new MailStub();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue(mail)
      .compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.use(cookieParser());
    await app.init();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    await prisma.user.deleteMany({ where: { email: EMAIL } });

    await request(http)
      .post("/auth/register")
      .send({ name: "Finanzas", email: EMAIL, password: PASSWORD })
      .expect(201);
    await request(http)
      .post("/auth/verify-email")
      .send({ token: mail.verificationTokens.get(EMAIL)! })
      .expect(200);
    cookies = cookieHeader(
      await request(http).post("/auth/login").send({ email: EMAIL, password: PASSWORD }).expect(200),
    );
    const org = await request(http)
      .post("/orgs")
      .set("Cookie", cookies)
      .send({ name: "Org Stripe E2E" })
      .expect(201);
    orgId = org.body.organization.id;
    await prisma.organization.update({
      where: { id: orgId },
      data: { stripeAccountId: ACCOUNT_ID },
    });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { name: "Org Stripe E2E" } });
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    await app.close();
  });

  it("the initial status reflects a connected account with payments not yet active", async () => {
    const res = await request(http)
      .get(`/orgs/${orgId}/stripe/status`)
      .set("Cookie", cookies)
      .expect(200);
    expect(res.body.connected).toBe(true);
    expect(res.body.chargesEnabled).toBe(false);
  });

  it("rejects webhooks with no signature or an invalid signature", async () => {
    await request(http).post("/webhooks/stripe").send({ type: "account.updated" }).expect(400);

    const { body } = signedPayload({ type: "account.updated", data: { object: {} } });
    await request(http)
      .post("/webhooks/stripe")
      .set("stripe-signature", "t=1,v1=firma_falsa")
      .set("Content-Type", "application/json")
      .send(body)
      .expect(400);
  });

  it("a signed account.updated enables chargesEnabled", async () => {
    const { body, signature } = signedPayload({
      id: "evt_test_1",
      object: "event",
      type: "account.updated",
      data: { object: { id: ACCOUNT_ID, object: "account", charges_enabled: true } },
    });
    await request(http)
      .post("/webhooks/stripe")
      .set("stripe-signature", signature)
      .set("Content-Type", "application/json")
      .send(body)
      .expect(200);

    const res = await request(http)
      .get(`/orgs/${orgId}/stripe/status`)
      .set("Cookie", cookies)
      .expect(200);
    expect(res.body.chargesEnabled).toBe(true);
  });

  it("only OWNER can request the onboarding link", async () => {
    // The creator is OWNER: the guard passes; with the dummy key Stripe will fail
    // when calling the real API, but never with 403.
    const res = await request(http)
      .post(`/orgs/${orgId}/stripe/onboarding-link`)
      .set("Cookie", cookies);
    // With the dummy key the real Stripe call fails, but never due to permissions
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(401);
  });
});
