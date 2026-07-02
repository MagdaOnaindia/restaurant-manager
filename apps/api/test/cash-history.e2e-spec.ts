import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { MailService } from "../src/mail/mail.service";
import { PrismaService } from "../src/prisma/prisma.service";

class MailStub {
  verificationTokens = new Map<string, string>();
  receipts: Array<{ to: string; amountCents: number }> = [];
  async sendVerificationEmail(to: string, _n: string, token: string) {
    this.verificationTokens.set(to, token);
  }
  async sendPasswordResetEmail() {}
  async sendInvitationEmail() {}
  async sendReservationConfirmation() {}
  async sendReservationCancelled() {}
  async sendPaymentReceipt(to: string, data: { amountCents: number }) {
    this.receipts.push({ to, amountCents: data.amountCents });
  }
}

const EMAIL = "caja.mixta@test.local";
const PASSWORD = "claveSegura1";

function cookieHeader(res: request.Response): string {
  const raw = (res.headers["set-cookie"] as unknown as string[]) ?? [];
  return raw.map((line) => line.split(";")[0]).join("; ");
}

describe("Cobro mixto e historial (e2e)", () => {
  let app: INestApplication;
  let mail: MailStub;
  let prisma: PrismaService;
  let http: ReturnType<INestApplication["getHttpServer"]>;
  let cookies: string;
  let restaurantId: string;
  let checkId: string;
  let checkToken: string;

  beforeAll(async () => {
    delete process.env.STRIPE_SECRET_KEY; // modo demo

    mail = new MailStub();
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
      .send({ name: "Caja", email: EMAIL, password: PASSWORD })
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
      .send({ name: "Org Caja E2E" })
      .expect(201);
    const rest = await request(http)
      .post(`/orgs/${org.body.organization.id}/restaurants`)
      .set("Cookie", cookies)
      .send({ name: "La Caja" })
      .expect(201);
    restaurantId = rest.body.restaurant.id;
    const zone = await request(http)
      .post(`/restaurants/${restaurantId}/zones`)
      .set("Cookie", cookies)
      .send({ name: "Sala" })
      .expect(201);
    const table = await request(http)
      .post(`/restaurants/${restaurantId}/zones/${zone.body.zone.id}/tables`)
      .set("Cookie", cookies)
      .send({ name: "Mesa 1", capacity: 4 })
      .expect(201);
    const check = await request(http)
      .post(`/restaurants/${restaurantId}/checks`)
      .set("Cookie", cookies)
      .send({ tableId: table.body.table.id })
      .expect(201);
    checkId = check.body.check.id;
    checkToken = check.body.check.publicToken;
    await request(http)
      .post(`/restaurants/${restaurantId}/checks/${checkId}/lines`)
      .set("Cookie", cookies)
      .send({ name: "Cena", unitPriceCents: 3000, quantity: 1 })
      .expect(201);
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { name: "Org Caja E2E" } });
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    await app.close();
  });

  it("cobro mixto: parte por QR (con recibo por email) y el resto en efectivo", async () => {
    // Comensal paga 10,00 por QR con recibo
    const intent = await request(http)
      .post(`/pay/checks/${checkToken}/intents`)
      .send({
        sessionId: "sesion-mixta-001",
        mode: "AMOUNT",
        amountCents: 1000,
        tipCents: 0,
        receiptEmail: "cliente@test.local",
      })
      .expect(200);
    await request(http)
      .post(`/pay/checks/${checkToken}/intents/${intent.body.paymentId}/dev-confirm`)
      .expect(200);
    expect(mail.receipts).toEqual([{ to: "cliente@test.local", amountCents: 1000 }]);

    // Efectivo por encima de lo pendiente → 400
    await request(http)
      .post(`/restaurants/${restaurantId}/checks/${checkId}/cash-payment`)
      .set("Cookie", cookies)
      .send({ amountCents: 2500 })
      .expect(400);

    // El resto (20,00) en efectivo → la cuenta queda PAGADA
    const res = await request(http)
      .post(`/restaurants/${restaurantId}/checks/${checkId}/cash-payment`)
      .set("Cookie", cookies)
      .send({ amountCents: 2000 })
      .expect(200);
    expect(res.body.check.status).toBe("PAID");
    expect(res.body.check.remainingCents).toBe(0);
    expect(res.body.check.payments).toHaveLength(2);
  });

  it("se cierra y aparece en el historial con totales y propinas", async () => {
    await request(http)
      .post(`/restaurants/${restaurantId}/checks/${checkId}/close`)
      .set("Cookie", cookies)
      .expect(200);

    const today = new Date().toLocaleDateString("en-CA");
    const history = await request(http)
      .get(`/restaurants/${restaurantId}/checks-history?from=${today}&to=${today}`)
      .set("Cookie", cookies)
      .expect(200);
    expect(history.body.checks).toHaveLength(1);
    const entry = history.body.checks[0];
    expect(entry.status).toBe("CLOSED");
    expect(entry.totalCents).toBe(3000);
    expect(entry.paidCents).toBe(3000);
    expect(entry.paymentCount).toBe(2);
  });
});
