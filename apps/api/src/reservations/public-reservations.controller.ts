import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { publicReservationSchema, type PublicReservationInput } from "@rms/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ReservationsService } from "./reservations.service";
import { PrismaService } from "../prisma/prisma.service";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

@Controller("public")
export class PublicReservationsController {
  constructor(
    private readonly reservations: ReservationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get("restaurants/:slug/availability")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async availability(
    @Param("slug") slug: string,
    @Query("date") date?: string,
    @Query("partySize") partySize?: string,
  ) {
    if (!date || !DATE_RE.test(date)) {
      throw new BadRequestException("Falta el parámetro date (AAAA-MM-DD)");
    }
    const restaurant = await this.prisma.restaurant.findUnique({ where: { slug } });
    if (!restaurant || !restaurant.isPublic) {
      throw new BadRequestException("Restaurante no encontrado");
    }
    const size = Math.max(1, Number(partySize) || 1);
    return { slots: await this.reservations.availability(restaurant, date, size) };
  }

  @Post("restaurants/:slug/reservations")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async create(
    @Param("slug") slug: string,
    @Body(new ZodValidationPipe(publicReservationSchema)) body: PublicReservationInput,
  ) {
    return { reservation: await this.reservations.createPublic(slug, body) };
  }

  @Get("reservations/:cancelToken")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async info(@Param("cancelToken") cancelToken: string) {
    return { reservation: await this.reservations.publicInfo(cancelToken) };
  }

  @Post("reservations/:cancelToken/cancel")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async cancel(@Param("cancelToken") cancelToken: string) {
    return this.reservations.publicCancel(cancelToken);
  }
}
