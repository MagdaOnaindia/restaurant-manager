import { z } from "zod";
import { emailSchema } from "./auth";

export const RESERVATION_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "SEATED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const RESERVATION_STATUS_LABELS_ES: Record<ReservationStatus, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  SEATED: "Sentados",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
  NO_SHOW: "No presentado",
};

const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora no válida (HH:MM)");
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida (AAAA-MM-DD)");

export const shiftSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    daysOfWeek: z.array(z.number().int().min(1).max(7)).max(7).default([]),
    startTime: timeString,
    endTime: timeString,
    slotMinutes: z.union([z.literal(15), z.literal(30), z.literal(60)]).default(15),
    maxCoversPerSlot: z.number().int().min(1).max(500).default(20),
    isActive: z.boolean().default(true),
  })
  .refine((s) => s.startTime < s.endTime, {
    message: "La hora de inicio debe ser anterior a la de fin",
  });
export type ShiftInput = z.infer<typeof shiftSchema>;

export const publicReservationSchema = z.object({
  date: dateString,
  time: timeString,
  partySize: z.number().int().min(1).max(50),
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z.string().trim().min(6).max(30),
  customerEmail: emailSchema.optional(),
  notes: z.string().trim().max(500).optional(),
});
export type PublicReservationInput = z.infer<typeof publicReservationSchema>;

export const staffReservationSchema = publicReservationSchema.extend({
  customerPhone: z.string().trim().max(30).optional(),
  // Staff can force a booking even when the slot is full
  force: z.boolean().default(false),
});
export type StaffReservationInput = z.infer<typeof staffReservationSchema>;

export const updateReservationSchema = z.object({
  status: z.enum(RESERVATION_STATUSES).optional(),
  tableId: z.string().nullable().optional(),
  partySize: z.number().int().min(1).max(50).optional(),
  time: timeString.optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});
export type UpdateReservationInput = z.infer<typeof updateReservationSchema>;

// ── Response types ──────────────────────────────────────────────────

export interface ShiftInfo {
  id: string;
  name: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  slotMinutes: number;
  maxCoversPerSlot: number;
  isActive: boolean;
}

export interface AvailabilitySlot {
  time: string;
  shiftId: string;
  shiftName: string;
  available: boolean;
}

export interface ReservationInfo {
  id: string;
  date: string;
  time: string;
  partySize: number;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  notes: string | null;
  tableId: string | null;
  tableName: string | null;
  status: ReservationStatus;
  source: "STAFF" | "PUBLIC";
  shiftName: string | null;
}

/** Generates a shift's start times: start..end inclusive, stepping by slotMinutes. */
export function shiftSlots(shift: { startTime: string; endTime: string; slotMinutes: number }): string[] {
  const toMinutes = (t: string) => {
    const [h = 0, m = 0] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const out: string[] = [];
  for (let m = toMinutes(shift.startTime); m <= toMinutes(shift.endTime); m += shift.slotMinutes) {
    out.push(
      `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`,
    );
  }
  return out;
}
