import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  shareAmount,
  type ClaimItemsInput,
  type CreatedIntentView,
  type CreateIntentInput,
  type PayCheckView,
  type ResolveTableView,
} from "@rms/shared";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { StripeService } from "../payments/stripe.service";
import { MailService } from "../mail/mail.service";
import { CheckEventsService } from "../checks/check-events.service";
import { computeTotals, LIVE_STATUSES } from "../checks/checks.service";

const CLAIM_TTL_MS = 3 * 60 * 1000; // reserva de ítems mientras se decide
const CLAIM_PAYING_TTL_MS = 10 * 60 * 1000; // reserva extendida durante el pago
const PENDING_RESERVATION_MS = 15 * 60 * 1000; // los intentos PENDING recientes reservan importe

interface CoverageClaims {
  mode: string;
  claims?: Array<{ lineId: string; units: number }>;
  shares?: { total: number; pay: number };
}

@Injectable()
export class SplitPayService {
  private readonly logger = new Logger(SplitPayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly mail: MailService,
    private readonly events: CheckEventsService,
    private readonly config: ConfigService,
  ) {}

  // ── Resolución del QR y vista pública ────────────────────────────

  async resolveTable(qrCode: string): Promise<ResolveTableView> {
    const table = await this.prisma.table.findUnique({
      where: { qrCode },
      include: { zone: { include: { restaurant: true } } },
    });
    if (!table) throw new NotFoundException("Mesa no encontrada");
    const check = await this.prisma.check.findFirst({
      where: { tableId: table.id, status: { in: [...LIVE_STATUSES] } },
    });
    return {
      restaurantName: table.zone.restaurant.name,
      tableName: table.name,
      checkToken: check?.publicToken ?? null,
    };
  }

  private async checkByToken(token: string) {
    const check = await this.prisma.check.findUnique({
      where: { publicToken: token },
      include: {
        restaurant: { select: { name: true, currency: true, organizationId: true } },
        lines: { orderBy: { createdAt: "asc" } },
        payments: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!check) throw new NotFoundException("Cuenta no encontrada");
    return check;
  }

  async view(token: string, sessionId?: string): Promise<PayCheckView> {
    const check = await this.checkByToken(token);
    const now = new Date();
    const activeClaims = await this.prisma.lineClaim.findMany({
      where: { checkId: check.id, expiresAt: { gt: now } },
    });

    const totals = computeTotals(check.lines, check.payments);
    return {
      token,
      restaurantName: check.restaurant.name,
      tableName: check.tableName,
      currency: check.restaurant.currency,
      status: check.status,
      totalCents: totals.totalCents,
      paidCents: totals.paidCents,
      remainingCents: totals.remainingCents,
      lines: check.lines.map((line) => {
        const others = activeClaims
          .filter((c) => c.lineId === line.id && c.sessionId !== sessionId)
          .reduce((acc, c) => acc + c.units, 0);
        const mine = activeClaims
          .filter((c) => c.lineId === line.id && c.sessionId === sessionId)
          .reduce((acc, c) => acc + c.units, 0);
        return {
          id: line.id,
          name: line.name,
          unitPriceCents: line.unitPriceCents,
          quantity: line.quantity,
          paidUnits: line.paidUnits,
          availableUnits: Math.max(0, line.quantity - line.paidUnits - others),
          myClaimedUnits: mine,
        };
      }),
      payments: check.payments
        .filter((p) => p.status === "SUCCEEDED")
        .map((p) => ({
          id: p.id,
          amountCents: p.amountCents,
          tipCents: p.tipCents,
          payerName: p.payerName,
          method: p.method,
          status: p.status,
          createdAt: p.createdAt.toISOString(),
        })),
      stripePublishableKey: this.config.get<string>("STRIPE_PUBLISHABLE_KEY") || null,
    };
  }

  // ── Reclamo de ítems (reparto por platos) ────────────────────────

  async claimItems(token: string, input: ClaimItemsInput): Promise<{ amountCents: number }> {
    const check = await this.checkByToken(token);
    this.assertPayable(check.status);
    const now = new Date();

    const amountCents = await this.prisma.$transaction(async (tx) => {
      // Los claims previos de esta sesión se sustituyen por la nueva selección
      await tx.lineClaim.deleteMany({
        where: { checkId: check.id, sessionId: input.sessionId, paymentId: null },
      });

      let amount = 0;
      for (const req of input.lines) {
        const line = check.lines.find((l) => l.id === req.lineId);
        if (!line) throw new NotFoundException("Alguna consumición ya no está en la cuenta");

        const othersClaimed = await tx.lineClaim.aggregate({
          where: {
            lineId: line.id,
            sessionId: { not: input.sessionId },
            expiresAt: { gt: now },
          },
          _sum: { units: true },
        });
        const available = line.quantity - line.paidUnits - (othersClaimed._sum.units ?? 0);
        if (req.units > available) {
          throw new ConflictException(
            `"${line.name}": otra persona de la mesa ya está pagando esas unidades`,
          );
        }
        await tx.lineClaim.create({
          data: {
            checkId: check.id,
            lineId: line.id,
            sessionId: input.sessionId,
            units: req.units,
            expiresAt: new Date(now.getTime() + CLAIM_TTL_MS),
          },
        });
        amount += line.unitPriceCents * req.units;
      }
      return amount;
    });

    this.events.emit(check.id);
    return { amountCents };
  }

  async releaseClaims(token: string, sessionId: string): Promise<{ ok: true }> {
    const check = await this.checkByToken(token);
    await this.prisma.lineClaim.deleteMany({
      where: { checkId: check.id, sessionId, paymentId: null },
    });
    this.events.emit(check.id);
    return { ok: true };
  }

  // ── Creación del pago ────────────────────────────────────────────

  private assertPayable(status: string) {
    if (status !== "OPEN" && status !== "PARTIALLY_PAID") {
      throw new BadRequestException(
        status === "PAID" || status === "CLOSED"
          ? "La cuenta ya está pagada. ¡Gracias!"
          : "La cuenta no admite pagos",
      );
    }
  }

  /** Importe reservado por intentos PENDING recientes (evita el doble "pagar todo"). */
  private pendingReservedCents(payments: { status: string; amountCents: number; method: string; updatedAt: Date }[]) {
    const cutoff = Date.now() - PENDING_RESERVATION_MS;
    return payments
      .filter(
        (p) => p.status === "PENDING" && p.method === "STRIPE" && p.updatedAt.getTime() > cutoff,
      )
      .reduce((acc, p) => acc + p.amountCents, 0);
  }

  async createIntent(token: string, input: CreateIntentInput): Promise<CreatedIntentView> {
    const check = await this.checkByToken(token);
    this.assertPayable(check.status);

    const totals = computeTotals(check.lines, check.payments);
    if (totals.remainingCents <= 0) {
      throw new BadRequestException("No queda nada por pagar");
    }
    const reserved = this.pendingReservedCents(check.payments);
    const payable = totals.remainingCents - reserved;

    let amountCents: number;
    let coverage: CoverageClaims;
    const now = new Date();

    switch (input.mode) {
      case "REMAINING": {
        amountCents = totals.remainingCents;
        if (reserved > 0) {
          throw new ConflictException(
            "Otra persona de la mesa está pagando ahora mismo. Espera un momento y recarga.",
          );
        }
        coverage = { mode: "REMAINING" };
        break;
      }
      case "SHARES": {
        const { total, pay } = input.shares!;
        amountCents = shareAmount(totals.remainingCents, total, pay);
        if (amountCents <= 0) throw new BadRequestException("El importe resultante es 0");
        if (amountCents > payable) {
          throw new ConflictException(
            "Otra persona está pagando ahora mismo y el importe supera lo pendiente. Recarga la cuenta.",
          );
        }
        coverage = { mode: "SHARES", shares: { total, pay } };
        break;
      }
      case "ITEMS": {
        const claims = await this.prisma.lineClaim.findMany({
          where: {
            checkId: check.id,
            sessionId: input.sessionId,
            paymentId: null,
            expiresAt: { gt: now },
          },
        });
        if (claims.length === 0) {
          throw new BadRequestException(
            "Tu selección ha caducado. Vuelve a elegir tus consumiciones.",
          );
        }
        amountCents = claims.reduce((acc, c) => {
          const line = check.lines.find((l) => l.id === c.lineId);
          return acc + (line ? line.unitPriceCents * c.units : 0);
        }, 0);
        coverage = {
          mode: "ITEMS",
          claims: claims.map((c) => ({ lineId: c.lineId, units: c.units })),
        };
        break;
      }
      case "AMOUNT": {
        amountCents = input.amountCents!;
        if (amountCents > payable) {
          throw new BadRequestException(
            `Como máximo quedan ${(payable / 100).toFixed(2)} € por pagar`,
          );
        }
        coverage = { mode: "AMOUNT" };
        break;
      }
    }

    if (amountCents < 50) {
      throw new BadRequestException("El importe mínimo de un pago con tarjeta es de 0,50 €");
    }

    const demoMode = !this.stripe.isConfigured;
    let stripeIntent: { id: string; clientSecret: string };

    if (demoMode) {
      // Sin claves de Stripe: flujo completo con confirmación simulada (solo dev)
      stripeIntent = {
        id: `demo_pi_${Math.random().toString(36).slice(2)}`,
        clientSecret: "demo_secret",
      };
    } else {
      // STRIPE_DIRECT_CHARGES=true (solo desarrollo): cobra a la cuenta de la
      // plataforma sin Connect, para probar tarjetas antes de activar Connect.
      const directCharges = this.config.get("STRIPE_DIRECT_CHARGES") === "true";
      let destinationAccountId: string | null = null;
      if (!directCharges) {
        const org = await this.prisma.organization.findUniqueOrThrow({
          where: { id: check.restaurant.organizationId },
        });
        if (!org.stripeAccountId || !org.stripeChargesEnabled) {
          throw new BadRequestException(
            "El restaurante aún no tiene los cobros online activados. Pide la cuenta al personal.",
          );
        }
        destinationAccountId = org.stripeAccountId;
      }
      stripeIntent = await this.stripe.createPaymentIntent({
        amountCents: amountCents + input.tipCents,
        currency: check.restaurant.currency,
        destinationAccountId,
        applicationFeeCents: 0,
        metadata: { checkId: check.id, mode: input.mode },
        receiptEmail: input.receiptEmail,
      });
    }

    const payment = await this.prisma.payment.create({
      data: {
        checkId: check.id,
        amountCents,
        tipCents: input.tipCents,
        method: "STRIPE",
        stripePaymentIntentId: stripeIntent.id,
        payerName: input.payerName ?? null,
        receiptEmail: input.receiptEmail ?? null,
        coverage: coverage as unknown as Prisma.InputJsonValue,
      },
    });

    if (input.mode === "ITEMS") {
      // Los claims quedan ligados al pago y protegidos mientras dura el cobro
      await this.prisma.lineClaim.updateMany({
        where: { checkId: check.id, sessionId: input.sessionId, paymentId: null },
        data: {
          paymentId: payment.id,
          expiresAt: new Date(now.getTime() + CLAIM_PAYING_TTL_MS),
        },
      });
    }

    this.events.emit(check.id);
    return {
      paymentId: payment.id,
      clientSecret: stripeIntent.clientSecret,
      amountCents,
      tipCents: input.tipCents,
      demoMode,
    };
  }

  // ── Resultado del pago (webhook = fuente de verdad) ──────────────

  /** Idempotente: los webhooks de Stripe pueden llegar repetidos. */
  async handleIntentSucceeded(stripePaymentIntentId: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { stripePaymentIntentId },
    });
    if (!payment) {
      this.logger.warn(`Webhook de intent desconocido: ${stripePaymentIntentId}`);
      return;
    }
    if (payment.status === "SUCCEEDED") return;

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "SUCCEEDED" },
      });

      // Reparto por ítems: marca las unidades como pagadas y libera los claims
      const coverage = payment.coverage as CoverageClaims | null;
      if (coverage?.mode === "ITEMS" && coverage.claims) {
        for (const claim of coverage.claims) {
          await tx.checkLine.update({
            where: { id: claim.lineId },
            data: { paidUnits: { increment: claim.units } },
          });
        }
        await tx.lineClaim.deleteMany({ where: { paymentId: payment.id } });
      }

      // Recalcular estado de la cuenta
      const check = await tx.check.findUniqueOrThrow({
        where: { id: payment.checkId },
        include: { lines: true, payments: true },
      });
      const totals = computeTotals(check.lines, check.payments);
      const newStatus = totals.remainingCents <= 0 ? "PAID" : "PARTIALLY_PAID";
      if (check.status === "OPEN" || check.status === "PARTIALLY_PAID") {
        await tx.check.update({ where: { id: check.id }, data: { status: newStatus } });
      }
    });

    this.events.emit(payment.checkId);
    this.logger.log(`Pago confirmado: ${payment.id} (${payment.amountCents}c)`);

    if (payment.receiptEmail) {
      const check = await this.prisma.check.findUniqueOrThrow({
        where: { id: payment.checkId },
        include: { restaurant: { select: { name: true } } },
      });
      await this.mail.sendPaymentReceipt(payment.receiptEmail, {
        restaurantName: check.restaurant.name,
        tableName: check.tableName,
        amountCents: payment.amountCents,
        tipCents: payment.tipCents,
        date: new Date().toLocaleDateString("es-ES"),
      });
    }
  }

  async handleIntentFailed(stripePaymentIntentId: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({ where: { stripePaymentIntentId } });
    if (!payment || payment.status === "SUCCEEDED") return;
    await this.prisma.$transaction([
      this.prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } }),
      // Libera los ítems reservados para que otros puedan pagarlos
      this.prisma.lineClaim.deleteMany({ where: { paymentId: payment.id } }),
    ]);
    this.events.emit(payment.checkId);
  }

  /** Confirmación simulada (solo cuando NO hay Stripe configurado; nunca en producción). */
  async devConfirm(token: string, paymentId: string): Promise<void> {
    if (this.stripe.isConfigured || this.config.get("NODE_ENV") === "production") {
      throw new BadRequestException("La confirmación simulada no está disponible");
    }
    const check = await this.checkByToken(token);
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, checkId: check.id },
    });
    if (!payment?.stripePaymentIntentId) throw new NotFoundException("Pago no encontrado");
    await this.handleIntentSucceeded(payment.stripePaymentIntentId);
  }
}
