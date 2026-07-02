import { z } from "zod";

export const createZoneSchema = z.object({
  name: z.string().trim().min(1, "Escribe el nombre de la zona").max(80),
});
export type CreateZoneInput = z.infer<typeof createZoneSchema>;

export const updateZoneSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  sortOrder: z.number().int().min(0).optional(),
});
export type UpdateZoneInput = z.infer<typeof updateZoneSchema>;

export const createTableSchema = z.object({
  name: z.string().trim().min(1, "Escribe el nombre o número de la mesa").max(40),
  capacity: z.number().int().min(1).max(100).default(2),
});
export type CreateTableInput = z.infer<typeof createTableSchema>;

export const updateTableSchema = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  capacity: z.number().int().min(1).max(100).optional(),
  sortOrder: z.number().int().min(0).optional(),
});
export type UpdateTableInput = z.infer<typeof updateTableSchema>;

export interface TableInfo {
  id: string;
  name: string;
  capacity: number;
  qrCode: string;
  sortOrder: number;
}

export interface ZoneWithTables {
  id: string;
  name: string;
  sortOrder: number;
  tables: TableInfo[];
}
