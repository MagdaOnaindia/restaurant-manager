import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "crypto";
import {
  getZonedParts,
  shiftSlots,
  type AvailabilitySlot,
  type PublicReservationInput,
  type ReservationInfo,
  type ShiftInput,
  type StaffReservationInput,
  type UpdateReservationInput,
} from "@rms/shared";
import type { Reservation, ReservationShift, Restaurant } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";

/** Estados que consumen aforo. */
const ACTIVE_STATUSES = ["PENDING", "CONFIRMED", "SEATED"] as const;

function isoDayOf(dateStr: string): number {
  // Día ISO (1=lunes) de una fecha AAAA-MM-DD, sin efectos de zona horaria
  const day = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function toInfo(
  r: Reservation & { table?: { name: string } | null; shift?: { name: string } | null },
): ReservationInfo {
  return {
    id: r.id,
    date: r.date.toISOString().slice(0, 10),
    time: r.time,
    partySize: r.partySize,
    customerName: r.customerName,
    customerPhone: r.customerPhone,
    customerEmail: r.customerEmail,
    notes: r.notes,
    tableId: r.tableId,
    tableName: r.table?.name ?? null,
    status: r.status,
    source: r.source,
    shiftName: r.shift?.name ?? null,
  };
}

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  // ── Turnos ───────────────────────────────────────────────────────

  async listShifts(restaurantId: string) {
    return this.prisma.reservationShift.findMany({
      where: { restaurantId },
      orderBy: { startTime: "asc" },
    });
  }

  async createShift(restaurantId: string, input: ShiftInput) {
    return this.prisma.reservationShift.create({ data: { restaurantId, ...input } });
  }

  async updateShift(restaurantId: string, shiftId: string, input: ShiftInput) {
    const shift = await this.prisma.reservationShift.findFirst({
      where: { id: shiftId, restaurantId },
    });
    if (!shift) throw new NotFoundException("Turno no encontrado");
    return this.prisma.reservationShift.update({ where: { id: shiftId }, data: input });
  }

  async removeShift(restaurantId: string, shiftId: string) {
    const shift = await this.prisma.reservationShift.findFirst({
      where: { id: shiftId, restaurantId },
    });
    if (!shift) throw new NotFoundException("Turno no encontrado");
    await this.prisma.reservationShift.delete({ where: { id: shiftId } });
    return { ok: true };
  }

  // ── Disponibilidad ───────────────────────────────────────────────

  /**
   * Huecos de entrada de un día. El aforo es "pacing": cada franja admite
   * hasta maxCoversPerSlot comensales de entrada; los estados activos consumen.
   */
  async availability(
    restaurant: Restaurant,
    dateStr: string,
    partySize: number,
    now = new Date(),
  ): Promise<AvailabilitySlot[]> {
    const isoDay = isoDayOf(dateStr);
    const shifts = await this.prisma.reservationShift.findMany({
      where: { restaurantId: restaurant.id, isActive: true },
    });
    const dayShifts = shifts.filter(
      (s) => s.daysOfWeek.length === 0 || s.daysOfWeek.includes(isoDay),
    );
    if (dayShifts.length === 0) return [];

    const reservations = await this.prisma.reservation.groupBy({
      by: ["time"],
      where: {
        restaurantId: restaurant.id,
        date: new Date(dateStr),
        status: { in: [...ACTIVE_STATUSES] },
      },
      _sum: { partySize: true },
    });
    const coversByTime = new Map(reservations.map((r) => [r.time, r._sum.partySize ?? 0]));

    // Si es hoy (en hora local del restaurante), no ofrecer horas pasadas
    const local = getZonedParts(now, restaurant.timezone);
    const isToday = local.date === dateStr;

    const slots: AvailabilitySlot[] = [];
    for (const shift of dayShifts) {
      for (const time of shiftSlots(shift)) {
        if (isToday && time <= local.time) continue;
        const used = coversByTime.get(time) ?? 0;
        slots.push({
          time,
          shiftId: shift.id,
          shiftName: shift.name,
          available: used + partySize <= shift.maxCoversPerSlot,
        });
      }
    }
    return slots.sort((a, b) => a.time.localeCompare(b.time));
  }

  private async findShiftForSlot(
    restaurantId: string,
    dateStr: string,
    time: string,
  ): Promise<ReservationShift | null> {
    const isoDay = isoDayOf(dateStr);
    const shifts = await this.prisma.reservationShift.findMany({
      where: { restaurantId, isActive: true },
    });
    return (
      shifts.find(
        (s) =>
          (s.daysOfWeek.length === 0 || s.daysOfWeek.includes(isoDay)) &&
          shiftSlots(s).includes(time),
      ) ?? null
    );
  }

  // ── Crear reservas ───────────────────────────────────────────────

  async createPublic(slug: string, input: PublicReservationInput) {
    const restaurant = await this.prisma.restaurant.findUnique({ where: { slug } });
    if (!restaurant || !restaurant.isPublic) throw new NotFoundException("Restaurante no encontrado");
    return this.create(restaurant, input, "PUBLIC", false);
  }

  async createStaff(restaurantId: string, input: StaffReservationInput) {
    const restaurant = await this.prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) throw new NotFoundException("Restaurante no encontrado");
    const { force, ...rest } = input;
    return this.create(restaurant, rest, "STAFF", force);
  }

  private async create(
    restaurant: Restaurant,
    input: PublicReservationInput | Omit<StaffReservationInput, "force">,
    source: "PUBLIC" | "STAFF",
    force: boolean,
  ) {
    const shift = await this.findShiftForSlot(restaurant.id, input.date, input.time);
    if (!shift && !force) {
      throw new BadRequestException("Esa hora no está disponible para reservas");
    }

    const reservation = await this.prisma.$transaction(async (tx) => {
      if (shift && !force) {
        const used = await tx.reservation.aggregate({
          where: {
            restaurantId: restaurant.id,
            date: new Date(input.date),
            time: input.time,
            status: { in: [...ACTIVE_STATUSES] },
          },
          _sum: { partySize: true },
        });
        if ((used._sum.partySize ?? 0) + input.partySize > shift.maxCoversPerSlot) {
          throw new ConflictException("Esa franja ya está completa. Elige otra hora.");
        }
      }
      return tx.reservation.create({
        data: {
          restaurantId: restaurant.id,
          shiftId: shift?.id ?? null,
          date: new Date(input.date),
          time: input.time,
          partySize: input.partySize,
          customerName: input.customerName,
          customerPhone: input.customerPhone ?? null,
          customerEmail: input.customerEmail ?? null,
          notes: input.notes ?? null,
          status: "CONFIRMED",
          source,
          cancelToken: randomBytes(24).toString("base64url"),
        },
      });
    });

    if (reservation.customerEmail) {
      await this.mail.sendReservationConfirmation(reservation.customerEmail, {
        customerName: reservation.customerName,
        restaurantName: restaurant.name,
        date: input.date,
        time: input.time,
        partySize: input.partySize,
        cancelToken: reservation.cancelToken,
      });
    }
    return toInfo(reservation);
  }

  // ── Gestión de reservas (backoffice) ─────────────────────────────

  async listByDate(restaurantId: string, dateStr: string): Promise<ReservationInfo[]> {
    const reservations = await this.prisma.reservation.findMany({
      where: { restaurantId, date: new Date(dateStr) },
      orderBy: [{ time: "asc" }, { createdAt: "asc" }],
      include: { table: { select: { name: true } }, shift: { select: { name: true } } },
    });
    return reservations.map(toInfo);
  }

  async update(restaurantId: string, reservationId: string, input: UpdateReservationInput) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id: reservationId, restaurantId },
    });
    if (!reservation) throw new NotFoundException("Reserva no encontrada");
    const updated = await this.prisma.reservation.update({
      where: { id: reservationId },
      data: input,
      include: { table: { select: { name: true } }, shift: { select: { name: true } } },
    });
    return toInfo(updated);
  }

  // ── Cancelación pública ──────────────────────────────────────────

  private async byCancelToken(token: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { cancelToken: token },
      include: { restaurant: { select: { name: true } } },
    });
    if (!reservation) throw new NotFoundException("Reserva no encontrada");
    return reservation;
  }

  async publicInfo(token: string) {
    const r = await this.byCancelToken(token);
    return {
      restaurantName: r.restaurant.name,
      date: r.date.toISOString().slice(0, 10),
      time: r.time,
      partySize: r.partySize,
      customerName: r.customerName,
      status: r.status,
    };
  }

  async publicCancel(token: string) {
    const r = await this.byCancelToken(token);
    if (r.status === "CANCELLED") return { ok: true };
    if (r.status !== "PENDING" && r.status !== "CONFIRMED") {
      throw new BadRequestException("Esta reserva ya no se puede cancelar");
    }
    await this.prisma.reservation.update({
      where: { id: r.id },
      data: { status: "CANCELLED" },
    });
    if (r.customerEmail) {
      await this.mail.sendReservationCancelled(r.customerEmail, {
        customerName: r.customerName,
        restaurantName: r.restaurant.name,
        date: r.date.toISOString().slice(0, 10),
        time: r.time,
      });
    }
    return { ok: true };
  }
}
