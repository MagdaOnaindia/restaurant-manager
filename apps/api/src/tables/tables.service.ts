import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  CreateTableInput,
  CreateZoneInput,
  UpdateTableInput,
  UpdateZoneInput,
  ZoneWithTables,
} from "@rms/shared";
import { PrismaService } from "../prisma/prisma.service";
import { shortCode } from "../common/slug";

@Injectable()
export class TablesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Zonas ────────────────────────────────────────────────────────

  async listZones(restaurantId: string): Promise<ZoneWithTables[]> {
    const zones = await this.prisma.zone.findMany({
      where: { restaurantId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        tables: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: { id: true, name: true, capacity: true, qrCode: true, sortOrder: true },
        },
      },
    });
    return zones.map((z) => ({
      id: z.id,
      name: z.name,
      sortOrder: z.sortOrder,
      tables: z.tables,
    }));
  }

  async createZone(restaurantId: string, input: CreateZoneInput) {
    const last = await this.prisma.zone.findFirst({
      where: { restaurantId },
      orderBy: { sortOrder: "desc" },
    });
    const zone = await this.prisma.zone.create({
      data: { restaurantId, name: input.name, sortOrder: (last?.sortOrder ?? -1) + 1 },
    });
    return zone;
  }

  private async zoneOf(restaurantId: string, zoneId: string) {
    const zone = await this.prisma.zone.findFirst({ where: { id: zoneId, restaurantId } });
    if (!zone) throw new NotFoundException("Zona no encontrada");
    return zone;
  }

  async updateZone(restaurantId: string, zoneId: string, input: UpdateZoneInput) {
    await this.zoneOf(restaurantId, zoneId);
    return this.prisma.zone.update({ where: { id: zoneId }, data: input });
  }

  async removeZone(restaurantId: string, zoneId: string) {
    await this.zoneOf(restaurantId, zoneId);
    await this.prisma.zone.delete({ where: { id: zoneId } });
    return { ok: true };
  }

  // ── Mesas ────────────────────────────────────────────────────────

  private async uniqueQrCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = `t-${shortCode(8)}`;
      const existing = await this.prisma.table.findUnique({ where: { qrCode: code } });
      if (!existing) return code;
    }
    return `t-${shortCode(12)}`;
  }

  async createTable(restaurantId: string, zoneId: string, input: CreateTableInput) {
    await this.zoneOf(restaurantId, zoneId);
    const last = await this.prisma.table.findFirst({
      where: { zoneId },
      orderBy: { sortOrder: "desc" },
    });
    return this.prisma.table.create({
      data: {
        zoneId,
        name: input.name,
        capacity: input.capacity,
        qrCode: await this.uniqueQrCode(),
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    });
  }

  private async tableOf(restaurantId: string, tableId: string) {
    const table = await this.prisma.table.findFirst({
      where: { id: tableId, zone: { restaurantId } },
    });
    if (!table) throw new NotFoundException("Mesa no encontrada");
    return table;
  }

  async updateTable(restaurantId: string, tableId: string, input: UpdateTableInput) {
    await this.tableOf(restaurantId, tableId);
    return this.prisma.table.update({ where: { id: tableId }, data: input });
  }

  async removeTable(restaurantId: string, tableId: string) {
    await this.tableOf(restaurantId, tableId);
    await this.prisma.table.delete({ where: { id: tableId } });
    return { ok: true };
  }
}
