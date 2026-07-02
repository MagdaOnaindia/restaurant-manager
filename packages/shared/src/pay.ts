import { z } from "zod";
import { emailSchema } from "./auth";
import type { CheckStatus } from "./checks";

export const SPLIT_MODES = ["REMAINING", "SHARES", "ITEMS", "AMOUNT"] as const;
export type SplitMode = (typeof SPLIT_MODES)[number];

export const claimItemsSchema = z.object({
  sessionId: z.string().min(8).max(64),
  lines: z
    .array(
      z.object({
        lineId: z.string().min(1),
        units: z.number().int().min(1).max(99),
      }),
    )
    .min(1)
    .max(50),
});
export type ClaimItemsInput = z.infer<typeof claimItemsSchema>;

export const releaseClaimsSchema = z.object({
  sessionId: z.string().min(8).max(64),
});
export type ReleaseClaimsInput = z.infer<typeof releaseClaimsSchema>;

export const createIntentSchema = z
  .object({
    sessionId: z.string().min(8).max(64),
    mode: z.enum(SPLIT_MODES),
    // SHARES: pago k de n partes
    shares: z
      .object({
        total: z.number().int().min(2).max(20),
        pay: z.number().int().min(1).max(20),
      })
      .optional(),
    // AMOUNT: importe libre en céntimos
    amountCents: z.number().int().min(50).optional(),
    tipCents: z.number().int().min(0).max(50_000).default(0),
    payerName: z.string().trim().max(60).optional(),
    receiptEmail: emailSchema.optional(),
  })
  .refine((v) => v.mode !== "SHARES" || (v.shares && v.shares.pay <= v.shares.total), {
    message: "Reparto en partes no válido",
  })
  .refine((v) => v.mode !== "AMOUNT" || v.amountCents !== undefined, {
    message: "Falta el importe",
  });
export type CreateIntentInput = z.infer<typeof createIntentSchema>;

// ── Vistas públicas del comensal ────────────────────────────────────

export interface PayLineView {
  id: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  paidUnits: number;
  /** Unidades que este comensal puede reclamar ahora (descuenta claims ajenos activos). */
  availableUnits: number;
  /** Unidades reclamadas por ESTA sesión. */
  myClaimedUnits: number;
}

export interface PayPaymentView {
  id: string;
  amountCents: number;
  tipCents: number;
  payerName: string | null;
  method: "STRIPE" | "CASH";
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED";
  createdAt: string;
}

export interface PayCheckView {
  token: string;
  restaurantName: string;
  tableName: string;
  currency: string;
  status: CheckStatus;
  lines: PayLineView[];
  totalCents: number;
  paidCents: number;
  remainingCents: number;
  payments: PayPaymentView[];
  /** Clave pública de Stripe; null = modo demo sin pasarela. */
  stripePublishableKey: string | null;
}

export interface CreatedIntentView {
  paymentId: string;
  clientSecret: string;
  amountCents: number;
  tipCents: number;
  /** true si no hay Stripe configurado: el front muestra confirmación demo. */
  demoMode: boolean;
}

export interface ResolveTableView {
  restaurantName: string;
  tableName: string;
  checkToken: string | null;
}

/** Reparto en partes iguales: importe de pagar k de n sobre lo pendiente. */
export function shareAmount(remainingCents: number, total: number, pay: number): number {
  if (pay >= total) return remainingCents;
  return Math.floor((remainingCents * pay) / total);
}
