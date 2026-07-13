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

const EMAIL = "camarera.checks@test.local";
const PASSWORD = "claveSegura1";

function cookieHeader(res: request.Response): string {
  const raw = (res.headers["set-cookie"] as unknown as string[]) ?? [];
  return raw.map((line) => line.split(";")[0]).join("; ");
}

describe("Bills and waiter view (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<INestApplication["getHttpServer"]>;
  let cookies: string;
  let restaurantId: string;
  let tableId: string;
  let gildaId: string;
  let checkId: string;

  beforeAll(async () => {
    const mail = new MailStub();
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
      .send({ name: "Camarera", email: EMAIL, password: PASSWORD })
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
      .send({ name: "Org Checks E2E" })
      .expect(201);
    const rest = await request(http)
      .post(`/orgs/${org.body.organization.id}/restaurants`)
      .set("Cookie", cookies)
      .send({ name: "Bar Comandero" })
      .expect(201);
    restaurantId = rest.body.restaurant.id;

    const zone = await request(http)
      .post(`/restaurants/${restaurantId}/zones`)
      .set("Cookie", cookies)
      .send({ name: "Barra" })
      .expect(201);
    const table = await request(http)
      .post(`/restaurants/${restaurantId}/zones/${zone.body.zone.id}/tables`)
      .set("Cookie", cookies)
      .send({ name: "Mesa 1", capacity: 4 })
      .expect(201);
    tableId = table.body.table.id;

    // Published menu with one dish
    const menu = await request(http)
      .post(`/restaurants/${restaurantId}/menus`)
      .set("Cookie", cookies)
      .send({ name: "Carta", type: "A_LA_CARTE" })
      .expect(201);
    const cat = await request(http)
      .post(`/restaurants/${restaurantId}/menus/${menu.body.menu.id}/categories`)
      .set("Cookie", cookies)
      .send({ name: "Pintxos" })
      .expect(201);
    const item = await request(http)
      .post(`/restaurants/${restaurantId}/categories/${cat.body.category.id}/items`)
      .set("Cookie", cookies)
      .send({ name: "Gilda", priceCents: 350 })
      .expect(201);
    gildaId = item.body.item.id;
    await request(http)
      .patch(`/restaurants/${restaurantId}/menus/${menu.body.menu.id}`)
      .set("Cookie", cookies)
      .send({ status: "PUBLISHED" })
      .expect(200);
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { name: "Org Checks E2E" } });
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    await app.close();
  });

  it("opens a bill on the table and refuses to open another", async () => {
    const res = await request(http)
      .post(`/restaurants/${restaurantId}/checks`)
      .set("Cookie", cookies)
      .send({ tableId })
      .expect(201);
    checkId = res.body.check.id;
    expect(res.body.check.status).toBe("OPEN");
    expect(res.body.check.tableName).toBe("Mesa 1");

    await request(http)
      .post(`/restaurants/${restaurantId}/checks`)
      .set("Cookie", cookies)
      .send({ tableId })
      .expect(409);
  });

  it("adds lines from the menu (snapshot) and accumulates quantities", async () => {
    await request(http)
      .post(`/restaurants/${restaurantId}/checks/${checkId}/lines`)
      .set("Cookie", cookies)
      .send({ menuItemId: gildaId, quantity: 2 })
      .expect(201);
    const res = await request(http)
      .post(`/restaurants/${restaurantId}/checks/${checkId}/lines`)
      .set("Cookie", cookies)
      .send({ menuItemId: gildaId, quantity: 1 })
      .expect(201);
    expect(res.body.check.lines).toHaveLength(1);
    expect(res.body.check.lines[0].quantity).toBe(3);
    expect(res.body.check.totalCents).toBe(1050);
  });

  it("the price snapshot survives menu changes", async () => {
    await request(http)
      .patch(`/restaurants/${restaurantId}/items/${gildaId}`)
      .set("Cookie", cookies)
      .send({ priceCents: 999 })
      .expect(200);
    const res = await request(http)
      .get(`/restaurants/${restaurantId}/checks/${checkId}`)
      .set("Cookie", cookies)
      .expect(200);
    expect(res.body.check.lines[0].unitPriceCents).toBe(350);
    expect(res.body.check.totalCents).toBe(1050);
  });

  it("accepts free-form lines and shows on the floor plan", async () => {
    const res = await request(http)
      .post(`/restaurants/${restaurantId}/checks/${checkId}/lines`)
      .set("Cookie", cookies)
      .send({ name: "Café especial", unitPriceCents: 200, quantity: 2 })
      .expect(201);
    expect(res.body.check.totalCents).toBe(1450);

    const floor = await request(http)
      .get(`/restaurants/${restaurantId}/floor`)
      .set("Cookie", cookies)
      .expect(200);
    const mesa = floor.body.zones[0].tables.find((t: { id: string }) => t.id === tableId);
    expect(mesa.check.id).toBe(checkId);
    expect(mesa.check.totalCents).toBe(1450);
  });

  it("controls quantities and line deletion", async () => {
    const detail = await request(http)
      .get(`/restaurants/${restaurantId}/checks/${checkId}`)
      .set("Cookie", cookies)
      .expect(200);
    const cafe = detail.body.check.lines.find((l: { name: string }) => l.name === "Café especial");

    const updated = await request(http)
      .patch(`/restaurants/${restaurantId}/checks/${checkId}/lines/${cafe.id}`)
      .set("Cookie", cookies)
      .send({ quantity: 1 })
      .expect(200);
    expect(updated.body.check.totalCents).toBe(1250);

    await request(http)
      .delete(`/restaurants/${restaurantId}/checks/${checkId}/lines/${cafe.id}`)
      .set("Cookie", cookies)
      .expect(200);
  });

  it("closes the bill and the table becomes free", async () => {
    const res = await request(http)
      .post(`/restaurants/${restaurantId}/checks/${checkId}/close`)
      .set("Cookie", cookies)
      .expect(200);
    expect(res.body.check.status).toBe("CLOSED");

    const floor = await request(http)
      .get(`/restaurants/${restaurantId}/floor`)
      .set("Cookie", cookies)
      .expect(200);
    const mesa = floor.body.zones[0].tables.find((t: { id: string }) => t.id === tableId);
    expect(mesa.check).toBeNull();

    // And it accepts no more lines
    await request(http)
      .post(`/restaurants/${restaurantId}/checks/${checkId}/lines`)
      .set("Cookie", cookies)
      .send({ menuItemId: gildaId, quantity: 1 })
      .expect(400);
  });

  it("cancelling requires the MANAGER role (the creator is OWNER, so allowed)", async () => {
    const open = await request(http)
      .post(`/restaurants/${restaurantId}/checks`)
      .set("Cookie", cookies)
      .send({ tableId })
      .expect(201);
    await request(http)
      .post(`/restaurants/${restaurantId}/checks/${open.body.check.id}/cancel`)
      .set("Cookie", cookies)
      .expect(200);
  });
});
