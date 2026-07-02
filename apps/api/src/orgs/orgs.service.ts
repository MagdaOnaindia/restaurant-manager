import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
import * as argon2 from "argon2";
import type {
  InvitationInfo,
  InviteMemberInput,
  MemberInfo,
  OrganizationWithRole,
  PublicInvitationInfo,
} from "@rms/shared";
import type { OrgRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { AuthService } from "../auth/auth.service";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

@Injectable()
export class OrgsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly auth: AuthService,
  ) {}

  // ── Organizaciones ───────────────────────────────────────────────

  async create(userId: string, name: string): Promise<OrganizationWithRole> {
    const org = await this.prisma.organization.create({
      data: {
        name,
        memberships: { create: { userId, role: "OWNER" } },
      },
    });
    return { id: org.id, name: org.name, role: "OWNER", stripeChargesEnabled: false, restaurants: [] };
  }

  async listMine(userId: string): Promise<OrganizationWithRole[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      include: {
        organization: {
          include: {
            restaurants: {
              orderBy: { createdAt: "asc" },
              select: { id: true, name: true, slug: true, city: true, isPublic: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      role: m.role,
      stripeChargesEnabled: m.organization.stripeChargesEnabled,
      restaurants: m.organization.restaurants,
    }));
  }

  async rename(orgId: string, name: string) {
    await this.prisma.organization.update({ where: { id: orgId }, data: { name } });
    return { ok: true };
  }

  async remove(orgId: string) {
    await this.prisma.organization.delete({ where: { id: orgId } });
    return { ok: true };
  }

  // ── Miembros ─────────────────────────────────────────────────────

  async listMembers(orgId: string): Promise<MemberInfo[]> {
    const members = await this.prisma.membership.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });
    return members.map((m) => ({
      membershipId: m.id,
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  async updateMemberRole(orgId: string, membershipId: string, role: OrgRole, actorUserId: string) {
    const target = await this.prisma.membership.findFirst({
      where: { id: membershipId, organizationId: orgId },
    });
    if (!target) throw new NotFoundException("Miembro no encontrado");
    if (target.role === "OWNER") {
      throw new ForbiddenException("No se puede cambiar el rol del propietario");
    }
    if (target.userId === actorUserId) {
      throw new ForbiddenException("No puedes cambiar tu propio rol");
    }
    await this.prisma.membership.update({ where: { id: target.id }, data: { role } });
    return { ok: true };
  }

  async removeMember(orgId: string, membershipId: string) {
    const target = await this.prisma.membership.findFirst({
      where: { id: membershipId, organizationId: orgId },
    });
    if (!target) throw new NotFoundException("Miembro no encontrado");
    if (target.role === "OWNER") {
      throw new ForbiddenException("No se puede quitar al propietario de la organización");
    }
    await this.prisma.membership.delete({ where: { id: target.id } });
    return { ok: true };
  }

  // ── Invitaciones ─────────────────────────────────────────────────

  async invite(orgId: string, inviterName: string, input: InviteMemberInput) {
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } });

    const existingUser = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existingUser) {
      const existingMembership = await this.prisma.membership.findUnique({
        where: { userId_organizationId: { userId: existingUser.id, organizationId: orgId } },
      });
      if (existingMembership) {
        throw new ConflictException("Esta persona ya es miembro de la organización");
      }
    }

    // Solo una invitación pendiente por email y organización
    await this.prisma.invitation.deleteMany({
      where: { organizationId: orgId, email: input.email, acceptedAt: null },
    });

    const token = randomBytes(32).toString("base64url");
    await this.prisma.invitation.create({
      data: {
        organizationId: orgId,
        email: input.email,
        role: input.role,
        tokenHash: sha256(token),
        invitedByName: inviterName,
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      },
    });
    await this.mail.sendInvitationEmail(input.email, org.name, inviterName, token);
    return { ok: true };
  }

  async listInvitations(orgId: string): Promise<InvitationInfo[]> {
    const invitations = await this.prisma.invitation.findMany({
      where: { organizationId: orgId, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    return invitations.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      expiresAt: i.expiresAt.toISOString(),
      createdAt: i.createdAt.toISOString(),
    }));
  }

  async revokeInvitation(orgId: string, invitationId: string) {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, organizationId: orgId, acceptedAt: null },
    });
    if (!invitation) throw new NotFoundException("Invitación no encontrada");
    await this.prisma.invitation.delete({ where: { id: invitation.id } });
    return { ok: true };
  }

  private async findValidInvitation(token: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: sha256(token) },
      include: { organization: { select: { name: true } } },
    });
    if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
      throw new BadRequestException("La invitación no es válida o ha caducado");
    }
    return invitation;
  }

  async getInvitationPublicInfo(token: string): Promise<PublicInvitationInfo> {
    const invitation = await this.findValidInvitation(token);
    const user = await this.prisma.user.findUnique({ where: { email: invitation.email } });
    return {
      organizationName: invitation.organization.name,
      email: invitation.email,
      role: invitation.role,
      userExists: user !== null,
      invitedByName: invitation.invitedByName,
    };
  }

  /** Acepta la invitación con una cuenta ya existente (el email debe coincidir). */
  async acceptExisting(userId: string, userEmail: string, token: string) {
    const invitation = await this.findValidInvitation(token);
    if (invitation.email !== userEmail) {
      throw new ForbiddenException(
        `La invitación es para ${invitation.email}. Inicia sesión con esa cuenta.`,
      );
    }
    await this.prisma.$transaction([
      this.prisma.membership.create({
        data: { userId, organizationId: invitation.organizationId, role: invitation.role },
      }),
      this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      }),
    ]);
    return { ok: true };
  }

  /** Acepta la invitación creando la cuenta (el email queda verificado al venir del propio correo). */
  async acceptNewUser(token: string, name: string, password: string) {
    const invitation = await this.findValidInvitation(token);
    const existing = await this.prisma.user.findUnique({ where: { email: invitation.email } });
    if (existing) {
      throw new ConflictException("Ya existe una cuenta con este email: inicia sesión para aceptar");
    }
    const user = await this.prisma.user.create({
      data: {
        email: invitation.email,
        name,
        passwordHash: await argon2.hash(password),
        emailVerifiedAt: new Date(),
        memberships: {
          create: { organizationId: invitation.organizationId, role: invitation.role },
        },
      },
    });
    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });
    return this.auth.issueTokensForUser(user.id);
  }
}
