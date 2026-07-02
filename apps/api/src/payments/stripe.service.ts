import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";

/**
 * Envoltorio del SDK de Stripe. Toda la plataforma habla con Stripe a través
 * de este servicio, lo que permite sustituirlo por un stub en los tests.
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

  /** Errores del SDK → 400 con mensaje útil (nunca se propaga el status de Stripe). */
  private async call<T>(action: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Stripe: fallo en ${action}: ${message}`);
      throw new BadRequestException(`Stripe: no se pudo ${action}. ${message}`);
    }
  }

  /** Crea una cuenta Connect Express (España) para la organización. */
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

  /** Enlace de onboarding hospedado por Stripe. */
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
   * PaymentIntent con destination charge: el comensal paga a la plataforma y
   * los fondos van a la cuenta conectada del restaurante (Fase 9).
   */
  async createPaymentIntent(params: {
    amountCents: number;
    currency: string;
    destinationAccountId: string;
    applicationFeeCents: number;
    metadata: Record<string, string>;
    receiptEmail?: string;
  }): Promise<{ id: string; clientSecret: string }> {
    const intent = await this.call("iniciar el pago", () =>
      this.stripe.paymentIntents.create({
        amount: params.amountCents,
        currency: params.currency.toLowerCase(),
        automatic_payment_methods: { enabled: true },
        transfer_data: { destination: params.destinationAccountId },
        application_fee_amount: params.applicationFeeCents || undefined,
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

  /** Verifica la firma del webhook y devuelve el evento. */
  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const secret = this.config.get<string>("STRIPE_WEBHOOK_SECRET");
    if (!secret) {
      throw new BadRequestException("STRIPE_WEBHOOK_SECRET no configurado");
    }
    return this.stripe.webhooks.constructEvent(rawBody, signature, secret);
  }
}
