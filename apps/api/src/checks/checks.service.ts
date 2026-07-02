import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import type {
  AddLineInput,
  CheckDetail,
  FloorZone,
  OpenCheckInput,
  UpdateLineInput,
} from "@rms/shared";
import type { Check, CheckLine } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

/** Estados en los que la cuenta sigue "viva" en la mesa. */
export const LIVE_STATUSES = ["OPEN", "PARTIALLY_PAID", "PAID"] as const;

export function computeTotals(lines: CheckLine[], manualPaidCents = 0) {
  const totalCents = lines.reduce((acc, l) => acc + l.unitPriceCents * l.quantity, 0);
  const paidByUnits = lines.reduce((acc, l) => acc + l.unitPriceCents * l.paidUnits, 0);
  // Nota: en Fase 9 los pagos reales vendrán de PaymentIntentRecord; paidUnits
  // marca unidades cubiertas por el reparto por ítems.
  const paidCents = paidByUnits + manualPaidCents;
  return { totalCents, paidCents, remainingCents: Math.max(0, totalCents - paidCents) };
}

@Injectable()
export class ChecksService {
  constructor(private readonly prisma: PrismaService) {}

  private toDetail(check: Check & { lines: CheckLine[] }): CheckDetail {
    const totals = computeTotals(check.lines);
    return {
      id: check.id,
      tableId: check.tableId,
      tableName: check.tableName,
      status: check.status,
      notes: check.notes,
      createdAt: check.createdAt.toISOString(),
      lines: check.lines.map((l) => ({
        id: l.id,
        menuItemId: l.menuItemId,
        name: l.name,
        unitPriceCents: l.unitPriceCents,
        quantity: l.quantity,
        paidUnits: l.paidUnits,
        notes: l.notes,
      })),
      ...totals,
    };
  }

  private async checkOf(restaurantId: string, checkId: string) {
    const check = await this.prisma.check.findFirst({
      where: { id: checkId, restaurantId },
      include: { lines: { orderBy: { createdAt: "asc" } } },
    });
    if (!check) throw new NotFoundException("Cuenta no encontrada");
    return check;
  }

  // ── Plano de sala ────────────────────────────────────────────────

  async floor(restaurantId: string): Promise<FloorZone[]> {
    const zones = await this.prisma.zone.findMany({
      where: { restaurantId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        tables: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          include: {
            checks: {
              where: { status: { in: [...LIVE_STATUSES] } },
              include: { lines: true },
              take: 1,
            },
          },
        },
      },
    });
    return zones.map((z) => ({
      id: z.id,
      name: z.name,
      tables: z.tables.map((t) => {
        const check = t.checks[0];
        return {
          id: t.id,
          name: t.name,
          capacity: t.capacity,
          qrCode: t.qrCode,
          check: check
            ? {
                id: check.id,
                status: check.status,
                totalCents: computeTotals(check.lines).totalCents,
                paidCents: computeTotals(check.lines).paidCents,
              }
            : null,
        };
      }),
    }));
  }

  // ── Ciclo de vida de la cuenta ───────────────────────────────────

  async open(restaurantId: string, userId: string, input: OpenCheckInput): Promise<CheckDetail> {
    const table = await this.prisma.table.findFirst({
      where: { id: input.tableId, zone: { restaurantId } },
    });
    if (!table) throw new NotFoundException("Mesa no encontrada");

    const check = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.check.findFirst({
        where: { tableId: table.id, status: { in: [...LIVE_STATUSES] } },
      });
      if (existing) {
        throw new ConflictException("Esta mesa ya tiene una cuenta abierta");
      }
      return tx.check.create({
        data: {
          restaurantId,
          tableId: table.id,
          tableName: table.name,
          notes: input.notes,
          openedById: userId,
          publicToken: randomBytes(16).toString("base64url"),
        },
        include: { lines: true },
      });
    });
    return this.toDetail(check);
  }

  async get(restaurantId: string, checkId: string): Promise<CheckDetail> {
    return this.toDetail(await this.checkOf(restaurantId, checkId));
  }

  async close(restaurantId: string, checkId: string): Promise<CheckDetail> {
    const check = await this.checkOf(restaurantId, checkId);
    if (check.status === "CLOSED" || check.status === "CANCELLED") {
      throw new BadRequestException("La cuenta ya está cerrada");
    }
    const updated = await this.prisma.check.update({
      where: { id: check.id },
      data: { status: "CLOSED", closedAt: new Date() },
      include: { lines: true },
    });
    return this.toDetail(updated);
  }

  async cancel(restaurantId: string, checkId: string): Promise<CheckDetail> {
    const check = await this.checkOf(restaurantId, checkId);
    if (check.status === "CLOSED" || check.status === "CANCELLED") {
      throw new BadRequestException("La cuenta ya está cerrada");
    }
    const { paidCents } = computeTotals(check.lines);
    if (paidCents > 0) {
      throw new BadRequestException("No se puede cancelar una cuenta con pagos registrados");
    }
    const updated = await this.prisma.check.update({
      where: { id: check.id },
      data: { status: "CANCELLED", closedAt: new Date() },
      include: { lines: true },
    });
    return this.toDetail(updated);
  }

  // ── Líneas ───────────────────────────────────────────────────────

  async addLine(restaurantId: string, checkId: string, input: AddLineInput): Promise<CheckDetail> {
    const check = await this.checkOf(restaurantId, checkId);
    if (check.status !== "OPEN" && check.status !== "PARTIALLY_PAID") {
      throw new BadRequestException("La cuenta no admite más consumiciones");
    }

    let name = input.name;
    let unitPriceCents = input.unitPriceCents;
    if (input.menuItemId) {
      const item = await this.prisma.menuItem.findFirst({
        where: { id: input.menuItemId, category: { menu: { restaurantId } } },
      });
      if (!item) throw new NotFoundException("Plato no encontrado en la carta");
      name = item.name;
      unitPriceCents = item.priceCents;
    }

    // Si ya existe una línea idéntica sin pagos, se acumula cantidad
    const existing = await this.prisma.checkLine.findFirst({
      where: {
        checkId: check.id,
        menuItemId: input.menuItemId ?? null,
        name: name!,
        unitPriceCents: unitPriceCents!,
        paidUnits: 0,
        notes: input.notes ?? null,
      },
    });
    if (existing && input.menuItemId) {
      await this.prisma.checkLine.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + input.quantity },
      });
    } else {
      await this.prisma.checkLine.create({
        data: {
          checkId: check.id,
          menuItemId: input.menuItemId ?? null,
          name: name!,
          unitPriceCents: unitPriceCents!,
          quantity: input.quantity,
          notes: input.notes,
        },
      });
    }
    return this.get(restaurantId, checkId);
  }

  async updateLine(
    restaurantId: string,
    checkId: string,
    lineId: string,
    input: UpdateLineInput,
  ): Promise<CheckDetail> {
    const check = await this.checkOf(restaurantId, checkId);
    const line = check.lines.find((l) => l.id === lineId);
    if (!line) throw new NotFoundException("Línea no encontrada");
    if (input.quantity !== undefined && input.quantity < line.paidUnits) {
      throw new BadRequestException(
        `No se puede bajar de ${line.paidUnits}: ya hay unidades pagadas`,
      );
    }
    await this.prisma.checkLine.update({ where: { id: lineId }, data: input });
    return this.get(restaurantId, checkId);
  }

  async removeLine(restaurantId: string, checkId: string, lineId: string): Promise<CheckDetail> {
    const check = await this.checkOf(restaurantId, checkId);
    const line = check.lines.find((l) => l.id === lineId);
    if (!line) throw new NotFoundException("Línea no encontrada");
    if (line.paidUnits > 0) {
      throw new BadRequestException("No se puede quitar una línea con unidades pagadas");
    }
    await this.prisma.checkLine.delete({ where: { id: lineId } });
    return this.get(restaurantId, checkId);
  }
}
