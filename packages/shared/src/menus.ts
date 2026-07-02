import { z } from "zod";
import { ALLERGENS } from "./constants";

export const MENU_TYPES = ["A_LA_CARTE", "FIXED_PRICE"] as const;
export type MenuType = (typeof MENU_TYPES)[number];

export const MENU_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export type MenuStatus = (typeof MENU_STATUSES)[number];

const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora no válida (formato HH:MM)");

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida (formato AAAA-MM-DD)");

export const createMenuSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre de la carta o menú").max(120),
  type: z.enum(MENU_TYPES).default("A_LA_CARTE"),
  description: z.string().trim().max(1000).optional(),
  priceCents: z.number().int().min(0).max(1_000_000).optional(),
});
export type CreateMenuInput = z.infer<typeof createMenuSchema>;

export const updateMenuSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  status: z.enum(MENU_STATUSES).optional(),
  priceCents: z.number().int().min(0).max(1_000_000).nullable().optional(),
});
export type UpdateMenuInput = z.infer<typeof updateMenuSchema>;

export const menuScheduleSchema = z
  .object({
    dateFrom: dateString.nullable().optional(),
    dateTo: dateString.nullable().optional(),
    daysOfWeek: z.array(z.number().int().min(1).max(7)).max(7).default([]),
    timeFrom: timeString.nullable().optional(),
    timeTo: timeString.nullable().optional(),
  })
  .refine((s) => !(s.dateFrom && s.dateTo) || s.dateFrom <= s.dateTo, {
    message: "La fecha de inicio debe ser anterior a la de fin",
  })
  .refine((s) => !(s.timeFrom && s.timeTo) || s.timeFrom < s.timeTo, {
    message: "La hora de inicio debe ser anterior a la de fin",
  });
export type MenuScheduleInput = z.infer<typeof menuScheduleSchema>;

export const setSchedulesSchema = z.object({
  schedules: z.array(menuScheduleSchema).max(10),
});
export type SetSchedulesInput = z.infer<typeof setSchedulesSchema>;

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  choiceCount: z.number().int().min(1).max(20).nullable().optional(),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.partial().extend({
  sortOrder: z.number().int().min(0).optional(),
});
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const createItemSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional(),
  priceCents: z.number().int().min(0).max(1_000_000).default(0),
  allergens: z.array(z.enum(ALLERGENS)).default([]),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  isAvailable: z.boolean().default(true),
  photoUrl: z.string().url().nullable().optional(),
});
export type CreateItemInput = z.infer<typeof createItemSchema>;

export const updateItemSchema = createItemSchema.partial().extend({
  sortOrder: z.number().int().min(0).optional(),
});
export type UpdateItemInput = z.infer<typeof updateItemSchema>;

// ── Tipos de respuesta ──────────────────────────────────────────────

export interface MenuScheduleInfo {
  id: string;
  dateFrom: string | null; // AAAA-MM-DD
  dateTo: string | null;
  daysOfWeek: number[];
  timeFrom: string | null;
  timeTo: string | null;
}

export interface MenuItemInfo {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  photoUrl: string | null;
  allergens: string[];
  tags: string[];
  isAvailable: boolean;
  sortOrder: number;
}

export interface MenuCategoryInfo {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  choiceCount: number | null;
  items: MenuItemInfo[];
}

export interface MenuSummary {
  id: string;
  name: string;
  description: string | null;
  type: MenuType;
  status: MenuStatus;
  priceCents: number | null;
  schedules: MenuScheduleInfo[];
  categoryCount: number;
  itemCount: number;
  activeNow: boolean;
}

export interface MenuDetail {
  id: string;
  name: string;
  description: string | null;
  type: MenuType;
  status: MenuStatus;
  priceCents: number | null;
  schedules: MenuScheduleInfo[];
  categories: MenuCategoryInfo[];
}

// ── Resolución de vigencias (compartida API + frontends) ───────────

interface ScheduleLike {
  dateFrom: string | null;
  dateTo: string | null;
  daysOfWeek: number[];
  timeFrom: string | null;
  timeTo: string | null;
}

/** Fecha/hora locales de una zona horaria: día ISO (1=lunes), "HH:MM" y "AAAA-MM-DD". */
export function getZonedParts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) parts[p.type] = p.value;
  const weekdayMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return {
    isoDay: weekdayMap[parts["weekday"] ?? "Mon"] ?? 1,
    time: `${parts["hour"]}:${parts["minute"]}`,
    date: `${parts["year"]}-${parts["month"]}-${parts["day"]}`,
  };
}

export function isScheduleActive(schedule: ScheduleLike, now: Date, timeZone: string): boolean {
  const { isoDay, time, date } = getZonedParts(now, timeZone);
  if (schedule.dateFrom && date < schedule.dateFrom) return false;
  if (schedule.dateTo && date > schedule.dateTo) return false;
  if (schedule.daysOfWeek.length > 0 && !schedule.daysOfWeek.includes(isoDay)) return false;
  if (schedule.timeFrom && time < schedule.timeFrom) return false;
  if (schedule.timeTo && time > schedule.timeTo) return false;
  return true;
}

/** Un menú sin vigencias está siempre activo; con varias, basta con que una aplique. */
export function isMenuActiveNow(
  menu: { schedules: ScheduleLike[] },
  now: Date,
  timeZone: string,
): boolean {
  if (menu.schedules.length === 0) return true;
  return menu.schedules.some((s) => isScheduleActive(s, now, timeZone));
}

export const DAY_LABELS_ES: Record<number, string> = {
  1: "Lun",
  2: "Mar",
  3: "Mié",
  4: "Jue",
  5: "Vie",
  6: "Sáb",
  7: "Dom",
};

/** Formatea céntimos como importe en euros ("12,50 €"). */
export function formatCents(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(cents / 100);
}
