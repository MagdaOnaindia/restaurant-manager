import { z } from "zod";

export const CHECK_STATUSES = ["OPEN", "PARTIALLY_PAID", "PAID", "CLOSED", "CANCELLED"] as const;
export type CheckStatus = (typeof CHECK_STATUSES)[number];

export const CHECK_STATUS_LABELS_ES: Record<CheckStatus, string> = {
  OPEN: "Abierta",
  PARTIALLY_PAID: "Pago parcial",
  PAID: "Pagada",
  CLOSED: "Cerrada",
  CANCELLED: "Cancelada",
};

export const openCheckSchema = z.object({
  tableId: z.string().min(1),
  notes: z.string().trim().max(300).optional(),
});
export type OpenCheckInput = z.infer<typeof openCheckSchema>;

/** Línea desde la carta (menuItemId, precio snapshot del servidor) o línea libre (name+precio). */
export const addLineSchema = z
  .object({
    menuItemId: z.string().optional(),
    name: z.string().trim().min(1).max(160).optional(),
    unitPriceCents: z.number().int().min(0).max(1_000_000).optional(),
    quantity: z.number().int().min(1).max(99).default(1),
    notes: z.string().trim().max(200).optional(),
  })
  .refine((v) => v.menuItemId || (v.name && v.unitPriceCents !== undefined), {
    message: "Indica un plato de la carta o un nombre y precio libres",
  });
export type AddLineInput = z.infer<typeof addLineSchema>;

export const updateLineSchema = z.object({
  quantity: z.number().int().min(1).max(99).optional(),
  notes: z.string().trim().max(200).nullable().optional(),
});
export type UpdateLineInput = z.infer<typeof updateLineSchema>;

/** Cobro manual (efectivo/datáfono propio) registrado por el personal. */
export const cashPaymentSchema = z.object({
  amountCents: z.number().int().min(1).max(1_000_000),
  payerName: z.string().trim().max(60).optional(),
});
export type CashPaymentInput = z.infer<typeof cashPaymentSchema>;

// ── Tipos de respuesta ──────────────────────────────────────────────

export interface CheckLineInfo {
  id: string;
  menuItemId: string | null;
  name: string;
  unitPriceCents: number;
  quantity: number;
  paidUnits: number;
  notes: string | null;
}

export interface CheckPaymentInfo {
  id: string;
  amountCents: number;
  tipCents: number;
  method: "STRIPE" | "CASH";
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED";
  payerName: string | null;
  createdAt: string;
}

export interface CheckDetail {
  id: string;
  tableId: string | null;
  tableName: string;
  status: CheckStatus;
  notes: string | null;
  createdAt: string;
  /** Token público de la cuenta: el comandero lo usa para el stream SSE. */
  publicToken: string;
  lines: CheckLineInfo[];
  payments: CheckPaymentInfo[];
  totalCents: number;
  paidCents: number;
  tipCents: number;
  remainingCents: number;
}

export interface CheckHistoryEntry {
  id: string;
  tableName: string;
  status: CheckStatus;
  createdAt: string;
  closedAt: string | null;
  totalCents: number;
  paidCents: number;
  tipCents: number;
  paymentCount: number;
}

export interface FloorTable {
  id: string;
  name: string;
  capacity: number;
  qrCode: string;
  check: {
    id: string;
    status: CheckStatus;
    totalCents: number;
    paidCents: number;
  } | null;
}

export interface FloorZone {
  id: string;
  name: string;
  tables: FloorTable[];
}
