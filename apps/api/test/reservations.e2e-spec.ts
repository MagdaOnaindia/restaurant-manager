import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { MailService } from "../src/mail/mail.service";
import { PrismaService } from "../src/prisma/prisma.service";

class MailStub {
  verificationTokens = new Map<string, string>();
  confirmations: Array<{ to: string; cancelToken: string }> = [];
  cancellations: string[] = [];

  async sendVerificationEmail(to: string, _n: string, token: string) {
    this.verificationTokens.set(to, token);
  }
  async sendPasswordResetEmail() {}
  async sendInvitationEmail() {}
  async sendReservationConfirmation(to: string, data: { cancelToken: string }) {
    this.confirmations.push({ to, cancelToken: data.cancelToken });
  }
  async sendReservationCancelled(to: string) {
    this.cancellations.push(to);
  }
}

const EMAIL = "sala.reservas@test.local";
const PASSWORD = "claveSegura1";
// Un miércoles futuro fijo para que los tests sean deterministas
const DATE = "2027-03-10";

function cookieHeader(res: request.Response): string {
  const raw = (res.headers["set-cookie"] as unknown as string[]) ?? [];
  return raw.map((line) => line.split(";")[0]).join("; ");
}

describe("Reservas (e2e)", () => {
  let app: INestApplication;
  let mail: MailStub;
  let prisma: PrismaService;
  let http: ReturnType<INestApplication["getHttpServer"]>;
  let cookies: string;
  let restaurantId: string;
  let slug: string;

  beforeAll(async () => {
    mail = new MailStub();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue(mail)
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    await prisma.user.deleteMany({ where: { email: EMAIL } });

    await request(http)
      .post("/auth/register")
      .send({ name: "Sala", email: EMAIL, password: PASSWORD })
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
      .send({ name: "Org Reservas E2E" })
      .expect(201);
    const rest = await request(http)
      .post(`/orgs/${org.body.organization.id}/restaurants`)
      .set("Cookie", cookies)
      .send({ name: "Mesón Disponibilidad" })
      .expect(201);
    restaurantId = rest.body.restaurant.id;
    slug = rest.body.restaurant.slug;
    await request(http)
      .patch(`/restaurants/${restaurantId}`)
      .set("Cookie", cookies)
      .send({ isPublic: true })
      .expect(200);
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { name: "Org Reservas E2E" } });
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    await app.close();
  });

  it("configura un turno de comida L-V con aforo 6 por franja", async () => {
    await request(http)
      .post(`/restaurants/${restaurantId}/shifts`)
      .set("Cookie", cookies)
      .send({
        name: "Comida",
        daysOfWeek: [1, 2, 3, 4, 5],
        startTime: "13:00",
        endTime: "15:00",
        slotMinutes: 30,
        maxCoversPerSlot: 6,
      })
      .expect(201);
  });

  it("la disponibilidad pública muestra las franjas del turno", async () => {
    const res = await request(http)
      .get(`/public/restaurants/${slug}/availability?date=${DATE}&partySize=2`)
      .expect(200);
    const times = res.body.slots.map((s: { time: string }) => s.time);
    expect(times).toEqual(["13:00", "13:30", "14:00", "14:30", "15:00"]);
    expect(res.body.slots.every((s: { available: boolean }) => s.available)).toBe(true);
  });

  it("un domingo no hay franjas (turno L-V)", async () => {
    const res = await request(http)
      .get(`/public/restaurants/${slug}/availability?date=2027-03-14&partySize=2`)
      .expect(200);
    expect(res.body.slots).toHaveLength(0);
  });

  let cancelToken: string;

  it("reserva pública con email de confirmación y consumo de aforo", async () => {
    await request(http)
      .post(`/public/restaurants/${slug}/reservations`)
      .send({
        date: DATE,
        time: "13:00",
        partySize: 5,
        customerName: "Familia López",
        customerPhone: "600111222",
        customerEmail: "lopez@cliente.test",
      })
      .expect(201);
    expect(mail.confirmations).toHaveLength(1);
    cancelToken = mail.confirmations[0]!.cancelToken;

    // Quedan 1 de 6: para 2 personas la franja 13:00 ya no está disponible
    const res = await request(http)
      .get(`/public/restaurants/${slug}/availability?date=${DATE}&partySize=2`)
      .expect(200);
    const slot13 = res.body.slots.find((s: { time: string }) => s.time === "13:00");
    expect(slot13.available).toBe(false);

    // Y una reserva que excede el aforo se rechaza
    await request(http)
      .post(`/public/restaurants/${slug}/reservations`)
      .send({
        date: DATE,
        time: "13:00",
        partySize: 2,
        customerName: "Pareja",
        customerPhone: "600333444",
      })
      .expect(409);
  });

  it("una hora fuera de turno se rechaza (pero el personal puede forzar)", async () => {
    await request(http)
      .post(`/public/restaurants/${slug}/reservations`)
      .send({
        date: DATE,
        time: "20:00",
        partySize: 2,
        customerName: "Nocturno",
        customerPhone: "600555666",
      })
      .expect(400);

    await request(http)
      .post(`/restaurants/${restaurantId}/reservations`)
      .set("Cookie", cookies)
      .send({ date: DATE, time: "20:00", partySize: 2, customerName: "VIP forzado", force: true })
      .expect(201);
  });

  it("el backoffice lista las reservas del día", async () => {
    const res = await request(http)
      .get(`/restaurants/${restaurantId}/reservations?date=${DATE}`)
      .set("Cookie", cookies)
      .expect(200);
    const names = res.body.reservations.map((r: { customerName: string }) => r.customerName);
    expect(names).toEqual(["Familia López", "VIP forzado"]);
  });

  it("cancelar por el enlace del email libera el aforo", async () => {
    const info = await request(http).get(`/public/reservations/${cancelToken}`).expect(200);
    expect(info.body.reservation.customerName).toBe("Familia López");

    await request(http).post(`/public/reservations/${cancelToken}/cancel`).expect(200);
    expect(mail.cancellations).toContain("lopez@cliente.test");

    const res = await request(http)
      .get(`/public/restaurants/${slug}/availability?date=${DATE}&partySize=2`)
      .expect(200);
    const slot13 = res.body.slots.find((s: { time: string }) => s.time === "13:00");
    expect(slot13.available).toBe(true);
  });

  it("cambiar estado desde el backoffice (SEATED)", async () => {
    const list = await request(http)
      .get(`/restaurants/${restaurantId}/reservations?date=${DATE}`)
      .set("Cookie", cookies)
      .expect(200);
    const vip = list.body.reservations.find(
      (r: { customerName: string }) => r.customerName === "VIP forzado",
    );
    const updated = await request(http)
      .patch(`/restaurants/${restaurantId}/reservations/${vip.id}`)
      .set("Cookie", cookies)
      .send({ status: "SEATED" })
      .expect(200);
    expect(updated.body.reservation.status).toBe("SEATED");
  });
});
