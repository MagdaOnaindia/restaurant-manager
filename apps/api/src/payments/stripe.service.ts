import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";

/**
 * Wrapper around the Stripe SDK. The whole platform talks to Stripe through
 * this service, which makes it easy to swap for a stub in tests.
 */
@Injectable()
export class StripeService {
  private client: Stripe | null = null;
  private readonly logger = new Logger(StripeService.name);

  constructor(private readonly config: ConfigService) {}

  get isConfigured(): boolean {
    return Boolean(this.config.get<string>("STRIPE_SECRET_KEY"));
  }

  private get stripe(): Stripe {
    const key = this.config.get<string>("STRIPE_SECRET_KEY");
    if (!key) {
      throw new BadRequestException(
        "Stripe no está configurado. Añade STRIPE_SECRET_KEY (modo test) en apps/api/.env.",
      );
    }
    if (!this.client) {
      this.client = new Stripe(key);
    }
    return this.client;
  }

  /** SDK errors → 400 with a helpful message (Stripe's status is never propagated). */
  private async call<T>(action: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Stripe: fallo en ${action}: ${message}`);
      throw new BadRequestException(`Stripe: no se pudo ${action}. ${message}`);
    }
  }

  /** Creates a Connect Express account (Spain) for the organization. */
  async createExpressAccount(orgName: string): Promise<string> {
    const account = await this.call("crear la cuenta de cobros", () =>
      this.stripe.accounts.create({
        type: "express",
        country: "ES",
        business_profile: { name: orgName },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      }),
    );
    return account.id;
  }

  /** Stripe-hosted onboarding link. */
  async createAccountLink(accountId: string, returnUrl: string, refreshUrl: string): Promise<string> {
    const link = await this.call("generar el enlace de onboarding", () =>
      this.stripe.accountLinks.create({
        account: accountId,
        type: "account_onboarding",
        return_url: returnUrl,
        refresh_url: refreshUrl,
      }),
    );
    return link.url;
  }

  async getAccount(accountId: string): Promise<Stripe.Account> {
    return this.call("consultar la cuenta", () => this.stripe.accounts.retrieve(accountId));
  }

  /**
   * PaymentIntent with a destination charge: the diner pays the platform and
   * the funds go to the restaurant's connected account (Phase 9).
   */
  async createPaymentIntent(params: {
    amountCents: number;
    currency: string;
    /** null = direct charge to the platform (dev only, no Connect) */
    destinationAccountId: string | null;
    applicationFeeCents: number;
    metadata: Record<string, string>;
    receiptEmail?: string;
  }): Promise<{ id: string; clientSecret: string }> {
    const intent = await this.call("iniciar el pago", () =>
      this.stripe.paymentIntents.create({
        amount: params.amountCents,
        currency: params.currency.toLowerCase(),
        automatic_payment_methods: { enabled: true },
        transfer_data: params.destinationAccountId
          ? { destination: params.destinationAccountId }
          : undefined,
        application_fee_amount:
          params.destinationAccountId && params.applicationFeeCents
            ? params.applicationFeeCents
            : undefined,
        metadata: params.metadata,
        receipt_email: params.receiptEmail,
      }),
    );
    if (!intent.client_secret) {
      this.logger.error(`PaymentIntent ${intent.id} sin client_secret`);
      throw new BadRequestException("No se pudo iniciar el pago");
    }
    return { id: intent.id, clientSecret: intent.client_secret };
  }

  /** Verifies the webhook signature and returns the event. */
  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const secret = this.config.get<string>("STRIPE_WEBHOOK_SECRET");
    if (!secret) {
      throw new BadRequestException("STRIPE_WEBHOOK_SECRET no configurado");
    }
    return this.stripe.webhooks.constructEvent(rawBody, signature, secret);
  }
}
