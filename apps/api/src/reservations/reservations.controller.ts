import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  shiftSchema,
  staffReservationSchema,
  updateReservationSchema,
  type ShiftInput,
  type StaffReservationInput,
  type UpdateReservationInput,
} from "@rms/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OrgRoles, OrgRolesGuard } from "../orgs/org-roles.guard";
import { ReservationsService } from "./reservations.service";
import { PrismaService } from "../prisma/prisma.service";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

@Controller("restaurants/:restaurantId")
@UseGuards(JwtAuthGuard, OrgRolesGuard)
export class ReservationsController {
  constructor(
    private readonly reservations: ReservationsService,
    private readonly prisma: PrismaService,
  ) {}

  // ── Shifts ───────────────────────────────────────────────────────

  @Get("shifts")
  @OrgRoles("STAFF")
  async listShifts(@Param("restaurantId") restaurantId: string) {
    return { shifts: await this.reservations.listShifts(restaurantId) };
  }

  @Post("shifts")
  @OrgRoles("MANAGER")
  async createShift(
    @Param("restaurantId") restaurantId: string,
    @Body(new ZodValidationPipe(shiftSchema)) body: ShiftInput,
  ) {
    return { shift: await this.reservations.createShift(restaurantId, body) };
  }

  @Put("shifts/:shiftId")
  @OrgRoles("MANAGER")
  async updateShift(
    @Param("restaurantId") restaurantId: string,
    @Param("shiftId") shiftId: string,
    @Body(new ZodValidationPipe(shiftSchema)) body: ShiftInput,
  ) {
    return { shift: await this.reservations.updateShift(restaurantId, shiftId, body) };
  }

  @Delete("shifts/:shiftId")
  @OrgRoles("MANAGER")
  async removeShift(@Param("restaurantId") restaurantId: string, @Param("shiftId") shiftId: string) {
    return this.reservations.removeShift(restaurantId, shiftId);
  }

  // ── Reservations ─────────────────────────────────────────────────

  @Get("reservations")
  @OrgRoles("STAFF")
  async listByDate(@Param("restaurantId") restaurantId: string, @Query("date") date?: string) {
    if (!date || !DATE_RE.test(date)) {
      throw new BadRequestException("Falta el parámetro date (AAAA-MM-DD)");
    }
    return { reservations: await this.reservations.listByDate(restaurantId, date) };
  }

  @Get("availability")
  @OrgRoles("STAFF")
  async availability(
    @Param("restaurantId") restaurantId: string,
    @Query("date") date?: string,
    @Query("partySize") partySize?: string,
  ) {
    if (!date || !DATE_RE.test(date)) {
      throw new BadRequestException("Falta el parámetro date (AAAA-MM-DD)");
    }
    const restaurant = await this.prisma.restaurant.findUniqueOrThrow({
      where: { id: restaurantId },
    });
    const size = Math.max(1, Number(partySize) || 1);
    return { slots: await this.reservations.availability(restaurant, date, size) };
  }

  @Post("reservations")
  @OrgRoles("STAFF")
  async create(
    @Param("restaurantId") restaurantId: string,
    @Body(new ZodValidationPipe(staffReservationSchema)) body: StaffReservationInput,
  ) {
    return { reservation: await this.reservations.createStaff(restaurantId, body) };
  }

  @Patch("reservations/:reservationId")
  @OrgRoles("STAFF")
  async update(
    @Param("restaurantId") restaurantId: string,
    @Param("reservationId") reservationId: string,
    @Body(new ZodValidationPipe(updateReservationSchema)) body: UpdateReservationInput,
  ) {
    return { reservation: await this.reservations.update(restaurantId, reservationId, body) };
  }
}
