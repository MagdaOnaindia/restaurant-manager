import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
  addLineSchema,
  cashPaymentSchema,
  openCheckSchema,
  updateLineSchema,
  type AddLineInput,
  type CashPaymentInput,
  type OpenCheckInput,
  type UpdateLineInput,
} from "@rms/shared";
import { Query } from "@nestjs/common";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { JwtAuthGuard, type RequestUser } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { OrgRoles, OrgRolesGuard } from "../orgs/org-roles.guard";
import { ChecksService } from "./checks.service";

@Controller("restaurants/:restaurantId")
@UseGuards(JwtAuthGuard, OrgRolesGuard)
export class ChecksController {
  constructor(private readonly checks: ChecksService) {}

  @Get("floor")
  @OrgRoles("STAFF")
  async floor(@Param("restaurantId") restaurantId: string) {
    return { zones: await this.checks.floor(restaurantId) };
  }

  @Post("checks")
  @OrgRoles("STAFF")
  async open(
    @Param("restaurantId") restaurantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(openCheckSchema)) body: OpenCheckInput,
  ) {
    return { check: await this.checks.open(restaurantId, user.userId, body) };
  }

  @Get("checks-history")
  @OrgRoles("MANAGER")
  async history(
    @Param("restaurantId") restaurantId: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return { checks: await this.checks.history(restaurantId, from, to) };
  }

  @Get("checks/:checkId")
  @OrgRoles("STAFF")
  async get(@Param("restaurantId") restaurantId: string, @Param("checkId") checkId: string) {
    return { check: await this.checks.get(restaurantId, checkId) };
  }

  @Post("checks/:checkId/cash-payment")
  @HttpCode(200)
  @OrgRoles("STAFF")
  async cashPayment(
    @Param("restaurantId") restaurantId: string,
    @Param("checkId") checkId: string,
    @Body(new ZodValidationPipe(cashPaymentSchema)) body: CashPaymentInput,
  ) {
    return {
      check: await this.checks.recordCashPayment(
        restaurantId,
        checkId,
        body.amountCents,
        body.payerName,
      ),
    };
  }

  @Post("checks/:checkId/close")
  @HttpCode(200)
  @OrgRoles("STAFF")
  async close(@Param("restaurantId") restaurantId: string, @Param("checkId") checkId: string) {
    return { check: await this.checks.close(restaurantId, checkId) };
  }

  @Post("checks/:checkId/cancel")
  @HttpCode(200)
  @OrgRoles("MANAGER")
  async cancel(@Param("restaurantId") restaurantId: string, @Param("checkId") checkId: string) {
    return { check: await this.checks.cancel(restaurantId, checkId) };
  }

  @Post("checks/:checkId/lines")
  @OrgRoles("STAFF")
  async addLine(
    @Param("restaurantId") restaurantId: string,
    @Param("checkId") checkId: string,
    @Body(new ZodValidationPipe(addLineSchema)) body: AddLineInput,
  ) {
    return { check: await this.checks.addLine(restaurantId, checkId, body) };
  }

  @Patch("checks/:checkId/lines/:lineId")
  @OrgRoles("STAFF")
  async updateLine(
    @Param("restaurantId") restaurantId: string,
    @Param("checkId") checkId: string,
    @Param("lineId") lineId: string,
    @Body(new ZodValidationPipe(updateLineSchema)) body: UpdateLineInput,
  ) {
    return { check: await this.checks.updateLine(restaurantId, checkId, lineId, body) };
  }

  @Delete("checks/:checkId/lines/:lineId")
  @OrgRoles("STAFF")
  async removeLine(
    @Param("restaurantId") restaurantId: string,
    @Param("checkId") checkId: string,
    @Param("lineId") lineId: string,
  ) {
    return { check: await this.checks.removeLine(restaurantId, checkId, lineId) };
  }
}
