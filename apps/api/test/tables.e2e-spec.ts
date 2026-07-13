import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { MailService } from "../src/mail/mail.service";
import { PrismaService } from "../src/prisma/prisma.service";

class MailStub {
  verificationTokens = new Map<string, string>();
  invitationTokens = new Map<string, string>();
  async sendVerificationEmail(to: string, _n: string, token: string) {
    this.verificationTokens.set(to, token);
  }
  async sendPasswordResetEmail() {}
  async sendInvitationEmail(to: string, _o: string, _i: string, token: string) {
    this.invitationTokens.set(to, token);
  }
}

const MANAGER_EMAIL = "gerente.tables@test.local";
const STAFF_EMAIL = "staff.tables@test.local";
const PASSWORD = "claveSegura1";

function cookieHeader(res: request.Response): string {
  const raw = (res.headers["set-cookie"] as unknown as string[]) ?? [];
  return raw.map((line) => line.split(";")[0]).join("; ");
}

describe("Zones and tables (e2e)", () => {
  let app: INestApplication;
  let mail: MailStub;
  let prisma: PrismaService;
  let http: ReturnType<INestApplication["getHttpServer"]>;
  let ownerCookies: string;
  let staffCookies: string;
  let orgId: string;
  let restaurantId: string;
  let zoneId: string;

  async function createVerifiedUser(email: string, name: string): Promise<string> {
    await request(http).post("/auth/register").send({ name, email, password: PASSWORD }).expect(201);
    await request(http)
      .post("/auth/verify-email")
      .send({ token: mail.verificationTokens.get(email)! })
      .expect(200);
    const login = await request(http).post("/auth/login").send({ email, password: PASSWORD }).expect(200);
    return cookieHeader(login);
  }

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
    await prisma.user.deleteMany({ where: { email: { endsWith: ".tables@test.local" } } });

    ownerCookies = await createVerifiedUser(MANAGER_EMAIL, "Gerente");
    const org = await request(http)
      .post("/orgs")
      .set("Cookie", ownerCookies)
      .send({ name: "Org Mesas E2E" })
      .expect(201);
    orgId = org.body.organization.id;
    const rest = await request(http)
      .post(`/orgs/${orgId}/restaurants`)
      .set("Cookie", ownerCookies)
      .send({ name: "Restaurante Mesas" })
      .expect(201);
    restaurantId = rest.body.restaurant.id;

    // STAFF via invitation
    await request(http)
      .post(`/orgs/${orgId}/invitations`)
      .set("Cookie", ownerCookies)
      .send({ email: STAFF_EMAIL, role: "STAFF" })
      .expect(201);
    const accept = await request(http)
      .post("/invitations/accept-new")
      .send({ token: mail.invitationTokens.get(STAFF_EMAIL)!, name: "Staff", password: PASSWORD })
      .expect(200);
    staffCookies = cookieHeader(accept);
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { name: "Org Mesas E2E" } });
    await prisma.user.deleteMany({ where: { email: { endsWith: ".tables@test.local" } } });
    await app.close();
  });

  it("creates zones and tables with a unique qrCode", async () => {
    const zone = await request(http)
      .post(`/restaurants/${restaurantId}/zones`)
      .set("Cookie", ownerCookies)
      .send({ name: "Terraza" })
      .expect(201);
    zoneId = zone.body.zone.id;

    const t1 = await request(http)
      .post(`/restaurants/${restaurantId}/zones/${zoneId}/tables`)
      .set("Cookie", ownerCookies)
      .send({ name: "Mesa 1", capacity: 4 })
      .expect(201);
    const t2 = await request(http)
      .post(`/restaurants/${restaurantId}/zones/${zoneId}/tables`)
      .set("Cookie", ownerCookies)
      .send({ name: "Mesa 2", capacity: 2 })
      .expect(201);

    expect(t1.body.table.qrCode).toMatch(/^t-/);
    expect(t1.body.table.qrCode).not.toBe(t2.body.table.qrCode);
  });

  it("lists zones with their tables in order", async () => {
    const res = await request(http)
      .get(`/restaurants/${restaurantId}/zones`)
      .set("Cookie", ownerCookies)
      .expect(200);
    expect(res.body.zones).toHaveLength(1);
    expect(res.body.zones[0].tables.map((t: { name: string }) => t.name)).toEqual([
      "Mesa 1",
      "Mesa 2",
    ]);
  });

  it("STAFF can view zones but not create or delete", async () => {
    await request(http)
      .get(`/restaurants/${restaurantId}/zones`)
      .set("Cookie", staffCookies)
      .expect(200);
    await request(http)
      .post(`/restaurants/${restaurantId}/zones`)
      .set("Cookie", staffCookies)
      .send({ name: "Barra" })
      .expect(403);
    await request(http)
      .delete(`/restaurants/${restaurantId}/zones/${zoneId}`)
      .set("Cookie", staffCookies)
      .expect(403);
  });

  it("doesn't allow operating on another restaurant's zones", async () => {
    const other = await request(http)
      .post(`/orgs/${orgId}/restaurants`)
      .set("Cookie", ownerCookies)
      .send({ name: "Otro restaurante" })
      .expect(201);
    await request(http)
      .post(`/restaurants/${other.body.restaurant.id}/zones/${zoneId}/tables`)
      .set("Cookie", ownerCookies)
      .send({ name: "Mesa intrusa", capacity: 2 })
      .expect(404);
  });
});
