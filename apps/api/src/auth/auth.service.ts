import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomBytes } from "crypto";
import * as argon2 from "argon2";
import type {
  AuthUser,
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  UpdateProfileInput,
} from "@rms/shared";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import type { User } from "@prisma/client";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días
const EMAIL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora

export interface JwtPayload {
  sub: string;
  email: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerifiedAt !== null,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  // ── Sign-up and verification ─────────────────────────────────────

  async register(input: RegisterInput): Promise<{ user: AuthUser }> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ConflictException(
        "Ya existe una cuenta con este email. Inicia sesión o restablece la contraseña.",
      );
    }
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash: await argon2.hash(input.password),
      },
    });
    await this.sendVerification(user);
    return { user: toAuthUser(user) };
  }

  private async sendVerification(user: User) {
    const token = await this.createOneTimeToken(user.id, "EMAIL_VERIFICATION", EMAIL_TOKEN_TTL_MS);
    await this.mail.sendVerificationEmail(user.email, user.name, token);
  }

  async resendVerification(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Silent response so we don't reveal whether the email exists
    if (!user || user.emailVerifiedAt) return;
    await this.sendVerification(user);
  }

  async verifyEmail(token: string): Promise<void> {
    const record = await this.consumeOneTimeToken(token, "EMAIL_VERIFICATION");
    await this.prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    });
  }

  // ── Login / sessions ─────────────────────────────────────────────

  async login(input: LoginInput): Promise<{ user: AuthUser; tokens: IssuedTokens }> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, input.password))) {
      throw new UnauthorizedException("Email o contraseña incorrectos");
    }
    if (!user.emailVerifiedAt) {
      throw new ForbiddenException({
        message: "Tu email aún no está verificado. Revisa tu bandeja de entrada.",
        code: "EMAIL_NOT_VERIFIED",
      });
    }
    const tokens = await this.issueTokens(user);
    return { user: toAuthUser(user), tokens };
  }

  private async issueTokens(user: User): Promise<IssuedTokens> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow("JWT_ACCESS_SECRET"),
      expiresIn: ACCESS_TOKEN_TTL,
    });
    const refreshToken = randomBytes(32).toString("base64url");
    const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    await this.prisma.session.create({
      data: { userId: user.id, refreshTokenHash: sha256(refreshToken), expiresAt: refreshExpiresAt },
    });
    return { accessToken, refreshToken, refreshExpiresAt };
  }

  async refresh(refreshToken: string): Promise<{ user: AuthUser; tokens: IssuedTokens }> {
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: sha256(refreshToken) },
      include: { user: true },
    });
    if (!session) throw new UnauthorizedException("Sesión no válida");
    if (session.revokedAt) {
      // Reuse of an already-rotated refresh token: possible theft → revoke everything
      await this.prisma.session.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException("Sesión no válida");
    }
    if (session.expiresAt < new Date()) throw new UnauthorizedException("Sesión caducada");

    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    const tokens = await this.issueTokens(session.user);
    return { user: toAuthUser(session.user), tokens };
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await this.prisma.session.updateMany({
      where: { refreshTokenHash: sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ── Passwords ────────────────────────────────────────────────────

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return; // silencioso: no revelar existencia
    const token = await this.createOneTimeToken(user.id, "PASSWORD_RESET", RESET_TOKEN_TTL_MS);
    await this.mail.sendPasswordResetEmail(user.email, user.name, token);
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const record = await this.consumeOneTimeToken(input.token, "PASSWORD_RESET");
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        // Resetting via email also verifies the address
        data: { passwordHash: await argon2.hash(input.password), emailVerifiedAt: new Date() },
      }),
      this.prisma.session.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash || !(await argon2.verify(user.passwordHash, input.currentPassword))) {
      throw new BadRequestException("La contraseña actual no es correcta");
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await argon2.hash(input.newPassword) },
    });
  }

  // ── Profile ──────────────────────────────────────────────────────

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return toAuthUser(user);
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<AuthUser> {
    const user = await this.prisma.user.update({ where: { id: userId }, data: { name: input.name } });
    return toAuthUser(user);
  }

  /**
   * Issues tokens for a user already validated by another path
   * (e.g. accepting an invitation while creating an account).
   */
  async issueTokensForUser(userId: string): Promise<{ user: AuthUser; tokens: IssuedTokens }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return { user: toAuthUser(user), tokens: await this.issueTokens(user) };
  }

  // ── Single-use tokens ────────────────────────────────────────────

  private async createOneTimeToken(
    userId: string,
    type: "EMAIL_VERIFICATION" | "PASSWORD_RESET",
    ttlMs: number,
  ): Promise<string> {
    // Invalidate previous unused tokens of the same type
    await this.prisma.verificationToken.deleteMany({ where: { userId, type, usedAt: null } });
    const token = randomBytes(32).toString("base64url");
    await this.prisma.verificationToken.create({
      data: { userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlMs) },
    });
    return token;
  }

  private async consumeOneTimeToken(token: string, type: "EMAIL_VERIFICATION" | "PASSWORD_RESET") {
    const record = await this.prisma.verificationToken.findUnique({
      where: { tokenHash: sha256(token) },
    });
    if (!record || record.type !== type || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException("El enlace no es válido o ha caducado. Solicita uno nuevo.");
    }
    await this.prisma.verificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    return record;
  }
}
