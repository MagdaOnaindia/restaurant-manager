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
}

const EMAIL = "chef.menus@test.local";
const PASSWORD = "claveSegura1";

function cookieHeader(res: request.Response): string {
  const raw = (res.headers["set-cookie"] as unknown as string[]) ?? [];
  return raw.map((line) => line.split(";")[0]).join("; ");
}

describe("Cartas y menús (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<INestApplication["getHttpServer"]>;
  let cookies: string;
  let restaurantId: string;
  let slug: string;
  let cartaId: string;
  let menuDiaId: string;

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
      .send({ name: "Chef", email: EMAIL, password: PASSWORD })
      .expect(201);
    await request(http)
      .post("/auth/verify-email")
      .send({ token: mail.verificationTokens.get(EMAIL)! })
      .expect(200);
    const login = await request(http)
      .post("/auth/login")
      .send({ email: EMAIL, password: PASSWORD })
      .expect(200);
    cookies = cookieHeader(login);

    const org = await request(http)
      .post("/orgs")
      .set("Cookie", cookies)
      .send({ name: "Org Menús E2E" })
      .expect(201);
    const rest = await request(http)
      .post(`/orgs/${org.body.organization.id}/restaurants`)
      .set("Cookie", cookies)
      .send({ name: "Bistró Vigencias" })
      .expect(201);
    restaurantId = rest.body.restaurant.id;
    slug = rest.body.restaurant.slug;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { name: "Org Menús E2E" } });
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    await app.close();
  });

  it("crea una carta con categorías y platos con alérgenos", async () => {
    const menu = await request(http)
      .post(`/restaurants/${restaurantId}/menus`)
      .set("Cookie", cookies)
      .send({ name: "Carta de verano", type: "A_LA_CARTE" })
      .expect(201);
    cartaId = menu.body.menu.id;

    const cat = await request(http)
      .post(`/restaurants/${restaurantId}/menus/${cartaId}/categories`)
      .set("Cookie", cookies)
      .send({ name: "Entrantes" })
      .expect(201);

    const item = await request(http)
      .post(`/restaurants/${restaurantId}/categories/${cat.body.category.id}/items`)
      .set("Cookie", cookies)
      .send({
        name: "Gazpacho andaluz",
        priceCents: 850,
        allergens: ["GLUTEN", "SULPHITES"],
        tags: ["frío", "vegano"],
      })
      .expect(201);
    expect(item.body.item.allergens).toEqual(["GLUTEN", "SULPHITES"]);

    const detail = await request(http)
      .get(`/restaurants/${restaurantId}/menus/${cartaId}`)
      .set("Cookie", cookies)
      .expect(200);
    expect(detail.body.menu.categories[0].items[0].name).toBe("Gazpacho andaluz");
  });

  it("configura vigencias: carta de verano por fechas, menú del día L-V 13-16", async () => {
    await request(http)
      .put(`/restaurants/${restaurantId}/menus/${cartaId}/schedules`)
      .set("Cookie", cookies)
      .send({ schedules: [{ dateFrom: "2026-06-01", dateTo: "2026-08-31", daysOfWeek: [] }] })
      .expect(200);

    const menuDia = await request(http)
      .post(`/restaurants/${restaurantId}/menus`)
      .set("Cookie", cookies)
      .send({ name: "Menú del día", type: "FIXED_PRICE", priceCents: 1450 })
      .expect(201);
    menuDiaId = menuDia.body.menu.id;

    await request(http)
      .put(`/restaurants/${restaurantId}/menus/${menuDiaId}/schedules`)
      .set("Cookie", cookies)
      .send({
        schedules: [{ daysOfWeek: [1, 2, 3, 4, 5], timeFrom: "13:00", timeTo: "16:00" }],
      })
      .expect(200);
  });

  it("los borradores no aparecen en los menús vigentes", async () => {
    // Miércoles 8 de julio de 2026, 14:00 en Madrid (12:00 UTC): ambas vigencias aplican
    const res = await request(http)
      .get(`/restaurants/${restaurantId}/menus/active?at=2026-07-08T12:00:00Z`)
      .set("Cookie", cookies)
      .expect(200);
    expect(res.body.menus).toHaveLength(0); // aún en borrador
  });

  it("resuelve correctamente las vigencias tras publicar", async () => {
    await request(http)
      .patch(`/restaurants/${restaurantId}/menus/${cartaId}`)
      .set("Cookie", cookies)
      .send({ status: "PUBLISHED" })
      .expect(200);
    await request(http)
      .patch(`/restaurants/${restaurantId}/menus/${menuDiaId}`)
      .set("Cookie", cookies)
      .send({ status: "PUBLISHED" })
      .expect(200);

    const activeAt = async (at: string) => {
      const res = await request(http)
        .get(`/restaurants/${restaurantId}/menus/active?at=${at}`)
        .set("Cookie", cookies)
        .expect(200);
      return res.body.menus.map((m: { name: string }) => m.name).sort();
    };

    // Miércoles 14:00 Madrid en julio → carta + menú del día
    expect(await activeAt("2026-07-08T12:00:00Z")).toEqual(["Carta de verano", "Menú del día"]);
    // Miércoles 17:30 Madrid → solo la carta (fuera de franja)
    expect(await activeAt("2026-07-08T15:30:00Z")).toEqual(["Carta de verano"]);
    // Sábado 14:00 Madrid → solo la carta (el menú del día es L-V)
    expect(await activeAt("2026-07-11T12:00:00Z")).toEqual(["Carta de verano"]);
    // Miércoles 14:00 Madrid en septiembre → solo el menú del día (carta caducada)
    expect(await activeAt("2026-09-16T12:00:00Z")).toEqual(["Menú del día"]);
  });

  it("el endpoint público exige que la página esté publicada", async () => {
    await request(http).get(`/public/restaurants/${slug}/menus`).expect(404);

    await request(http)
      .patch(`/restaurants/${restaurantId}`)
      .set("Cookie", cookies)
      .send({ isPublic: true })
      .expect(200);

    const res = await request(http)
      .get(`/public/restaurants/${slug}/menus?at=2026-07-08T12:00:00Z`)
      .expect(200);
    expect(res.body.restaurant.name).toBe("Bistró Vigencias");
    expect(res.body.menus).toHaveLength(2);
  });

  it("duplica un menú completo como borrador", async () => {
    const dup = await request(http)
      .post(`/restaurants/${restaurantId}/menus/${cartaId}/duplicate`)
      .set("Cookie", cookies)
      .expect(201);
    expect(dup.body.menu.name).toBe("Carta de verano (copia)");
    expect(dup.body.menu.status).toBe("DRAFT");

    const detail = await request(http)
      .get(`/restaurants/${restaurantId}/menus/${dup.body.menu.id}`)
      .set("Cookie", cookies)
      .expect(200);
    expect(detail.body.menu.categories[0].items[0].name).toBe("Gazpacho andaluz");
    expect(detail.body.menu.schedules).toHaveLength(1);
  });

  it("valida los datos con Zod (precio negativo, hora inválida)", async () => {
    await request(http)
      .post(`/restaurants/${restaurantId}/menus`)
      .set("Cookie", cookies)
      .send({ name: "Mal menú", type: "FIXED_PRICE", priceCents: -5 })
      .expect(400);
    await request(http)
      .put(`/restaurants/${restaurantId}/menus/${menuDiaId}/schedules`)
      .set("Cookie", cookies)
      .send({ schedules: [{ timeFrom: "25:00", timeTo: "26:00" }] })
      .expect(400);
  });
});
