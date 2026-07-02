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

  async sendVerificationEmail(to: string, _name: string, token: string) {
    this.verificationTokens.set(to, token);
  }
  async sendPasswordResetEmail() {}
  async sendInvitationEmail(to: string, _orgName: string, _inviter: string, token: string) {
    this.invitationTokens.set(to, token);
  }
}

const OWNER_EMAIL = "duena.orgs@test.local";
const STAFF_EMAIL = "camarero.orgs@test.local";
const OUTSIDER_EMAIL = "ajeno.orgs@test.local";
const PASSWORD = "claveSegura1";

function cookieHeader(res: request.Response): string {
  const raw = (res.headers["set-cookie"] as unknown as string[]) ?? [];
  return raw.map((line) => line.split(";")[0]).join("; ");
}

describe("Organizaciones y roles (e2e)", () => {
  let app: INestApplication;
  let mail: MailStub;
  let prisma: PrismaService;
  let http: ReturnType<INestApplication["getHttpServer"]>;

  let ownerCookies: string;
  let staffCookies: string;
  let outsiderCookies: string;
  let orgId: string;
  let restaurantId: string;
  let staffMembershipId: string;

  async function createVerifiedUser(email: string, name: string): Promise<string> {
    await request(http).post("/auth/register").send({ name, email, password: PASSWORD }).expect(201);
    const token = mail.verificationTokens.get(email)!;
    await request(http).post("/auth/verify-email").send({ token }).expect(200);
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
    await prisma.user.deleteMany({ where: { email: { endsWith: ".orgs@test.local" } } });

    ownerCookies = await createVerifiedUser(OWNER_EMAIL, "Dueña");
    outsiderCookies = await createVerifiedUser(OUTSIDER_EMAIL, "Ajeno");
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { name: "Grupo Tapeo E2E" } });
    await prisma.user.deleteMany({ where: { email: { endsWith: ".orgs@test.local" } } });
    await app.close();
  });

  it("crea una organización y su creadora es OWNER", async () => {
    const res = await request(http)
      .post("/orgs")
      .set("Cookie", ownerCookies)
      .send({ name: "Grupo Tapeo E2E" })
      .expect(201);
    orgId = res.body.organization.id;
    expect(res.body.organization.role).toBe("OWNER");

    const list = await request(http).get("/orgs").set("Cookie", ownerCookies).expect(200);
    expect(list.body.organizations.some((o: { id: string }) => o.id === orgId)).toBe(true);
  });

  it("crea un restaurante con slug único", async () => {
    const res = await request(http)
      .post(`/orgs/${orgId}/restaurants`)
      .set("Cookie", ownerCookies)
      .send({ name: "Café Ñandú", city: "Madrid" })
      .expect(201);
    restaurantId = res.body.restaurant.id;
    expect(res.body.restaurant.slug).toMatch(/^cafe-nandu/);
  });

  it("invita a un STAFF y la invitación se consulta públicamente", async () => {
    await request(http)
      .post(`/orgs/${orgId}/invitations`)
      .set("Cookie", ownerCookies)
      .send({ email: STAFF_EMAIL, role: "STAFF" })
      .expect(201);
    const token = mail.invitationTokens.get(STAFF_EMAIL)!;
    expect(token).toBeTruthy();

    const info = await request(http).get(`/invitations/${token}`).expect(200);
    expect(info.body.invitation.organizationName).toBe("Grupo Tapeo E2E");
    expect(info.body.invitation.userExists).toBe(false);
  });

  it("acepta la invitación creando cuenta nueva (email ya verificado)", async () => {
    const token = mail.invitationTokens.get(STAFF_EMAIL)!;
    const res = await request(http)
      .post("/invitations/accept-new")
      .send({ token, name: "Camarero", password: PASSWORD })
      .expect(200);
    staffCookies = cookieHeader(res);
    expect(res.body.user.emailVerified).toBe(true);

    const list = await request(http).get("/orgs").set("Cookie", staffCookies).expect(200);
    const org = list.body.organizations.find((o: { id: string }) => o.id === orgId);
    expect(org.role).toBe("STAFF");
  });

  it("STAFF puede listar restaurantes pero no editarlos ni invitar", async () => {
    await request(http).get(`/orgs/${orgId}/restaurants`).set("Cookie", staffCookies).expect(200);
    await request(http)
      .patch(`/restaurants/${restaurantId}`)
      .set("Cookie", staffCookies)
      .send({ name: "Hackeado" })
      .expect(403);
    await request(http)
      .post(`/orgs/${orgId}/invitations`)
      .set("Cookie", staffCookies)
      .send({ email: "otro@test.local", role: "STAFF" })
      .expect(403);
  });

  it("un usuario ajeno a la organización no ve sus recursos", async () => {
    await request(http).get(`/restaurants/${restaurantId}`).set("Cookie", outsiderCookies).expect(403);
    await request(http).get(`/orgs/${orgId}/members`).set("Cookie", outsiderCookies).expect(403);
  });

  it("ADMIN sube de rol al STAFF y entonces puede editar el restaurante", async () => {
    const members = await request(http)
      .get(`/orgs/${orgId}/members`)
      .set("Cookie", ownerCookies)
      .expect(200);
    const staff = members.body.members.find((m: { email: string }) => m.email === STAFF_EMAIL);
    staffMembershipId = staff.membershipId;

    await request(http)
      .patch(`/orgs/${orgId}/members/${staffMembershipId}`)
      .set("Cookie", ownerCookies)
      .send({ role: "MANAGER" })
      .expect(200);

    await request(http)
      .patch(`/restaurants/${restaurantId}`)
      .set("Cookie", staffCookies)
      .send({ description: "Tapas de autor" })
      .expect(200);
  });

  it("no se puede tocar al OWNER ni el propio rol", async () => {
    const members = await request(http)
      .get(`/orgs/${orgId}/members`)
      .set("Cookie", ownerCookies)
      .expect(200);
    const owner = members.body.members.find((m: { email: string }) => m.email === OWNER_EMAIL);

    await request(http)
      .patch(`/orgs/${orgId}/members/${owner.membershipId}`)
      .set("Cookie", ownerCookies)
      .send({ role: "STAFF" })
      .expect(403);
    await request(http)
      .delete(`/orgs/${orgId}/members/${owner.membershipId}`)
      .set("Cookie", ownerCookies)
      .expect(403);
  });

  it("la invitación aceptada no se puede reutilizar", async () => {
    const token = mail.invitationTokens.get(STAFF_EMAIL)!;
    await request(http)
      .post("/invitations/accept-new")
      .send({ token, name: "Doble", password: PASSWORD })
      .expect(400);
  });

  it("solo OWNER puede borrar la organización", async () => {
    await request(http).delete(`/orgs/${orgId}`).set("Cookie", staffCookies).expect(403);
  });
});
