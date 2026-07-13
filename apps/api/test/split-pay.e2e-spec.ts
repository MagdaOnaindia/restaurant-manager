import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import cookieParser from "cookie-parser";
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

const EMAIL = "mesa.splitpay@test.local";
const PASSWORD = "claveSegura1";
const SESSION_A = "sesion-ana-0001";
const SESSION_B = "sesion-carlos-02";

function cookieHeader(res: request.Response): string {
  const raw = (res.headers["set-cookie"] as unknown as string[]) ?? [];
  return raw.map((line) => line.split(";")[0]).join("; ");
}

describe("Split payments (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<INestApplication["getHttpServer"]>;
  let cookies: string;
  let restaurantId: string;
  let tableQr: string;
  let checkToken: string;
  let checkId: string;
  let lineGilda: string;
  let lineCania: string;

  async function payView(sessionId?: string) {
    const res = await request(http)
      .get(`/pay/checks/${checkToken}${sessionId ? `?sessionId=${sessionId}` : ""}`)
      .expect(200);
    return res.body;
  }

  async function confirm(paymentId: string) {
    await request(http)
      .post(`/pay/checks/${checkToken}/intents/${paymentId}/dev-confirm`)
      .expect(200);
  }

  beforeAll(async () => {
    // Demo mode: with no Stripe configured, the flow uses a simulated confirmation.
    // Set to "" (not delete) so it wins over any value in a local .env file.
    process.env.STRIPE_SECRET_KEY = "";
    process.env.STRIPE_DIRECT_CHARGES = "";

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

    // Restaurant with a table and an open bill with items
    await request(http)
      .post("/auth/register")
      .send({ name: "Mesa", email: EMAIL, password: PASSWORD })
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
      .send({ name: "Org SplitPay E2E" })
      .expect(201);
    const rest = await request(http)
      .post(`/orgs/${org.body.organization.id}/restaurants`)
      .set("Cookie", cookies)
      .send({ name: "Casa Dividida" })
      .expect(201);
    restaurantId = rest.body.restaurant.id;
    const zone = await request(http)
      .post(`/restaurants/${restaurantId}/zones`)
      .set("Cookie", cookies)
      .send({ name: "Comedor" })
      .expect(201);
    const table = await request(http)
      .post(`/restaurants/${restaurantId}/zones/${zone.body.zone.id}/tables`)
      .set("Cookie", cookies)
      .send({ name: "Mesa 7", capacity: 4 })
      .expect(201);
    tableQr = table.body.table.qrCode;

    const check = await request(http)
      .post(`/restaurants/${restaurantId}/checks`)
      .set("Cookie", cookies)
      .send({ tableId: table.body.table.id })
      .expect(201);
    checkId = check.body.check.id;

    // Free-form lines: 2x Gilda (3,50), 1x Tortilla (12,00), 3x Caña (2,50) → total 26,50
    for (const l of [
      { name: "Gilda", unitPriceCents: 350, quantity: 2 },
      { name: "Tortilla", unitPriceCents: 1200, quantity: 1 },
      { name: "Caña", unitPriceCents: 250, quantity: 3 },
    ]) {
      await request(http)
        .post(`/restaurants/${restaurantId}/checks/${checkId}/lines`)
        .set("Cookie", cookies)
        .send(l)
        .expect(201);
    }
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { name: "Org SplitPay E2E" } });
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    await app.close();
  });

  it("the table QR resolves to the open bill", async () => {
    const res = await request(http).get(`/pay/t/${tableQr}`).expect(200);
    expect(res.body.restaurantName).toBe("Casa Dividida");
    expect(res.body.tableName).toBe("Mesa 7");
    expect(res.body.checkToken).toBeTruthy();
    checkToken = res.body.checkToken;
  });

  it("the diner view shows lines and totals", async () => {
    const view = await payView(SESSION_A);
    expect(view.totalCents).toBe(2650);
    expect(view.paidCents).toBe(0);
    expect(view.remainingCents).toBe(2650);
    expect(view.lines).toHaveLength(3);
    lineGilda = view.lines.find((l: { name: string }) => l.name === "Gilda").id;
    lineCania = view.lines.find((l: { name: string }) => l.name === "Caña").id;
  });

  it("item split: one session's claims block the other", async () => {
    // Ana claims 2 Gildas and 1 caña (9,50)
    const claim = await request(http)
      .post(`/pay/checks/${checkToken}/claims`)
      .send({
        sessionId: SESSION_A,
        lines: [
          { lineId: lineGilda, units: 2 },
          { lineId: lineCania, units: 1 },
        ],
      })
      .expect(200);
    expect(claim.body.amountCents).toBe(950);

    // Carlos tries to claim a Gilda: none are available
    await request(http)
      .post(`/pay/checks/${checkToken}/claims`)
      .send({ sessionId: SESSION_B, lines: [{ lineId: lineGilda, units: 1 }] })
      .expect(409);

    // Carlos's view reflects Ana's reservation
    const viewB = await payView(SESSION_B);
    const gildaB = viewB.lines.find((l: { id: string }) => l.id === lineGilda);
    expect(gildaB.availableUnits).toBe(0);
  });

  it("pays their items (with a tip) and the units get marked paid", async () => {
    const intent = await request(http)
      .post(`/pay/checks/${checkToken}/intents`)
      .send({ sessionId: SESSION_A, mode: "ITEMS", tipCents: 100, payerName: "Ana" })
      .expect(200);
    expect(intent.body.demoMode).toBe(true);
    expect(intent.body.amountCents).toBe(950);

    await confirm(intent.body.paymentId);

    const view = await payView(SESSION_A);
    expect(view.paidCents).toBe(950);
    expect(view.remainingCents).toBe(1700);
    expect(view.status).toBe("PARTIALLY_PAID");
    const gilda = view.lines.find((l: { id: string }) => l.id === lineGilda);
    expect(gilda.paidUnits).toBe(2);
    expect(view.payments[0].payerName).toBe("Ana");
    expect(view.payments[0].tipCents).toBe(100);
  });

  it("equal split: 1 of 2 shares of the remaining balance", async () => {
    const intent = await request(http)
      .post(`/pay/checks/${checkToken}/intents`)
      .send({ sessionId: SESSION_B, mode: "SHARES", shares: { total: 2, pay: 1 }, tipCents: 0 })
      .expect(200);
    expect(intent.body.amountCents).toBe(850); // floor(1700/2)

    await confirm(intent.body.paymentId);
    const view = await payView();
    expect(view.remainingCents).toBe(850);
  });

  it("two people pay «all the remaining» at once: the second gets a conflict", async () => {
    const first = await request(http)
      .post(`/pay/checks/${checkToken}/intents`)
      .send({ sessionId: SESSION_A, mode: "REMAINING", tipCents: 0 })
      .expect(200);
    expect(first.body.amountCents).toBe(850);

    // Without confirming the first, the second attempt is blocked
    await request(http)
      .post(`/pay/checks/${checkToken}/intents`)
      .send({ sessionId: SESSION_B, mode: "REMAINING", tipCents: 0 })
      .expect(409);

    await confirm(first.body.paymentId);
    const view = await payView();
    expect(view.remainingCents).toBe(0);
    expect(view.status).toBe("PAID");
  });

  it("once the bill is paid, no more payments are accepted", async () => {
    await request(http)
      .post(`/pay/checks/${checkToken}/intents`)
      .send({ sessionId: SESSION_B, mode: "AMOUNT", amountCents: 100, tipCents: 0 })
      .expect(400);
  });

  it("custom amount: validates cap and minimum; exact odd split with k=n", async () => {
    // New 10,00 € bill on another table
    const zone = await request(http)
      .post(`/restaurants/${restaurantId}/zones`)
      .set("Cookie", cookies)
      .send({ name: "Terraza 2" })
      .expect(201);
    const table = await request(http)
      .post(`/restaurants/${restaurantId}/zones/${zone.body.zone.id}/tables`)
      .set("Cookie", cookies)
      .send({ name: "Mesa T1", capacity: 2 })
      .expect(201);
    const check = await request(http)
      .post(`/restaurants/${restaurantId}/checks`)
      .set("Cookie", cookies)
      .send({ tableId: table.body.table.id })
      .expect(201);
    await request(http)
      .post(`/restaurants/${restaurantId}/checks/${check.body.check.id}/lines`)
      .set("Cookie", cookies)
      .send({ name: "Menú", unitPriceCents: 1000, quantity: 1 })
      .expect(201);
    const resolved = await request(http).get(`/pay/t/${table.body.table.qrCode}`).expect(200);
    const token2 = resolved.body.checkToken;

    // Custom amount above the remaining balance → 400
    await request(http)
      .post(`/pay/checks/${token2}/intents`)
      .send({ sessionId: SESSION_A, mode: "AMOUNT", amountCents: 1200, tipCents: 0 })
      .expect(400);
    // Below the card minimum → 400 (Zod validation, min 50)
    await request(http)
      .post(`/pay/checks/${token2}/intents`)
      .send({ sessionId: SESSION_A, mode: "AMOUNT", amountCents: 20, tipCents: 0 })
      .expect(400);

    // 10,00 across 3: first share 3,33
    const p1 = await request(http)
      .post(`/pay/checks/${token2}/intents`)
      .send({ sessionId: SESSION_A, mode: "SHARES", shares: { total: 3, pay: 1 }, tipCents: 0 })
      .expect(200);
    expect(p1.body.amountCents).toBe(333);
    await request(http)
      .post(`/pay/checks/${token2}/intents/${p1.body.paymentId}/dev-confirm`)
      .expect(200);

    // Last: k=n pays exactly the remaining balance (6,67) → exact sum, no lost cents
    const p2 = await request(http)
      .post(`/pay/checks/${token2}/intents`)
      .send({ sessionId: SESSION_B, mode: "SHARES", shares: { total: 2, pay: 2 }, tipCents: 0 })
      .expect(200);
    expect(p2.body.amountCents).toBe(667);
    await request(http)
      .post(`/pay/checks/${token2}/intents/${p2.body.paymentId}/dev-confirm`)
      .expect(200);

    const view = await request(http).get(`/pay/checks/${token2}`).expect(200);
    expect(view.body.remainingCents).toBe(0);
    expect(view.body.status).toBe("PAID");
  });

  it("the waiter view sees the payment status on the floor plan", async () => {
    const floor = await request(http)
      .get(`/restaurants/${restaurantId}/floor`)
      .set("Cookie", cookies)
      .expect(200);
    const mesa7 = floor.body.zones
      .flatMap((z: { tables: unknown[] }) => z.tables)
      .find((t: { name: string }) => t.name === "Mesa 7") as {
      check: { status: string; paidCents: number };
    };
    expect(mesa7.check.status).toBe("PAID");
    expect(mesa7.check.paidCents).toBe(2650);
  });
});
