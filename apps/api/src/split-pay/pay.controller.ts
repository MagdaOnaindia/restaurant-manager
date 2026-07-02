import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Sse,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Observable } from "rxjs";
import {
  claimItemsSchema,
  createIntentSchema,
  releaseClaimsSchema,
  type ClaimItemsInput,
  type CreateIntentInput,
  type ReleaseClaimsInput,
} from "@rms/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { SplitPayService } from "./split-pay.service";
import { CheckEventsService } from "../checks/check-events.service";
import { PrismaService } from "../prisma/prisma.service";
import { NotFoundException } from "@nestjs/common";

/** API pública del comensal (sin autenticación; acceso por tokens opacos). */
@Controller("pay")
export class PayController {
  constructor(
    private readonly splitPay: SplitPayService,
    private readonly events: CheckEventsService,
    private readonly prisma: PrismaService,
  ) {}

  /** Resuelve el QR físico de la mesa a la cuenta abierta. */
  @Get("t/:qrCode")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async resolveTable(@Param("qrCode") qrCode: string) {
    return this.splitPay.resolveTable(qrCode);
  }

  @Get("checks/:token")
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async view(@Param("token") token: string, @Query("sessionId") sessionId?: string) {
    return this.splitPay.view(token, sessionId);
  }

  /** Estado de la cuenta en tiempo real (SSE). */
  @Sse("checks/:token/events")
  async stream(@Param("token") token: string): Promise<Observable<{ data: string; type: string }>> {
    const check = await this.prisma.check.findUnique({ where: { publicToken: token } });
    if (!check) throw new NotFoundException("Cuenta no encontrada");
    return this.events.streamFor(check.id);
  }

  @Post("checks/:token/claims")
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async claim(
    @Param("token") token: string,
    @Body(new ZodValidationPipe(claimItemsSchema)) body: ClaimItemsInput,
  ) {
    return this.splitPay.claimItems(token, body);
  }

  @Post("checks/:token/claims/release")
  @HttpCode(200)
  async release(
    @Param("token") token: string,
    @Body(new ZodValidationPipe(releaseClaimsSchema)) body: ReleaseClaimsInput,
  ) {
    return this.splitPay.releaseClaims(token, body.sessionId);
  }

  @Post("checks/:token/intents")
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async createIntent(
    @Param("token") token: string,
    @Body(new ZodValidationPipe(createIntentSchema)) body: CreateIntentInput,
  ) {
    return this.splitPay.createIntent(token, body);
  }

  /** Confirmación simulada para desarrollo sin claves de Stripe. */
  @Post("checks/:token/intents/:paymentId/dev-confirm")
  @HttpCode(200)
  async devConfirm(@Param("token") token: string, @Param("paymentId") paymentId: string) {
    await this.splitPay.devConfirm(token, paymentId);
    return { ok: true };
  }
}
