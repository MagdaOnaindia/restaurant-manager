import { Controller, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OrgRoles, OrgRolesGuard } from "../orgs/org-roles.guard";
import { PrismaService } from "../prisma/prisma.service";
import { StripeService } from "./stripe.service";

@Controller("orgs/:orgId/stripe")
@UseGuards(JwtAuthGuard, OrgRolesGuard)
export class ConnectController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly config: ConfigService,
  ) {}

  @Get("status")
  @OrgRoles("ADMIN")
  async status(@Param("orgId") orgId: string) {
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    return {
      configured: this.stripe.isConfigured,
      connected: Boolean(org.stripeAccountId),
      chargesEnabled: org.stripeChargesEnabled,
    };
  }

  /** Crea (si hace falta) la cuenta Connect y devuelve el enlace de onboarding. */
  @Post("onboarding-link")
  @HttpCode(200)
  @OrgRoles("OWNER")
  async onboardingLink(@Param("orgId") orgId: string) {
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } });

    let accountId = org.stripeAccountId;
    if (!accountId) {
      accountId = await this.stripe.createExpressAccount(org.name);
      await this.prisma.organization.update({
        where: { id: orgId },
        data: { stripeAccountId: accountId },
      });
    }

    const webUrl = this.config.get("WEB_URL", "http://localhost:3100");
    const url = await this.stripe.createAccountLink(
      accountId,
      `${webUrl}/app/payments?onboarding=done`,
      `${webUrl}/app/payments?onboarding=retry`,
    );
    return { url };
  }

  /** Re-sincroniza el estado de la cuenta (por si el webhook no llegó en dev). */
  @Post("sync")
  @HttpCode(200)
  @OrgRoles("ADMIN")
  async sync(@Param("orgId") orgId: string) {
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    if (!org.stripeAccountId) return { connected: false, chargesEnabled: false };
    const account = await this.stripe.getAccount(org.stripeAccountId);
    const chargesEnabled = Boolean(account.charges_enabled);
    await this.prisma.organization.update({
      where: { id: orgId },
      data: { stripeChargesEnabled: chargesEnabled },
    });
    return { connected: true, chargesEnabled };
  }
}
