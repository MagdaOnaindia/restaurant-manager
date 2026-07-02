import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
} from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import type Stripe from "stripe";
import { PrismaService } from "../prisma/prisma.service";
import { StripeService } from "./stripe.service";
import { SplitPayService } from "../split-pay/split-pay.service";

/**
 * Receptor de webhooks de Stripe (fuente de verdad de pagos y cuentas).
 * En desarrollo: stripe listen --forward-to localhost:4000/webhooks/stripe
 */
@Controller("webhooks/stripe")
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly splitPay: SplitPayService,
  ) {}

  @Post()
  @HttpCode(200)
  async handle(@Req() req: RawBodyRequest<Request>, @Headers("stripe-signature") signature?: string) {
    if (!signature || !req.rawBody) {
      throw new BadRequestException("Falta la firma del webhook");
    }
    let event: Stripe.Event;
    try {
      event = this.stripe.constructWebhookEvent(req.rawBody, signature);
    } catch {
      throw new BadRequestException("Firma de webhook no válida");
    }

    switch (event.type) {
      case "account.updated": {
        const account = event.data.object;
        await this.prisma.organization.updateMany({
          where: { stripeAccountId: account.id },
          data: { stripeChargesEnabled: Boolean(account.charges_enabled) },
        });
        this.logger.log(
          `account.updated ${account.id}: charges_enabled=${account.charges_enabled}`,
        );
        break;
      }
      case "payment_intent.succeeded": {
        const intent = event.data.object as Stripe.PaymentIntent;
        await this.splitPay.handleIntentSucceeded(intent.id);
        break;
      }
      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent;
        await this.splitPay.handleIntentFailed(intent.id);
        break;
      }
      default:
        this.logger.debug(`Evento ignorado: ${event.type}`);
    }
    return { received: true };
  }
}
