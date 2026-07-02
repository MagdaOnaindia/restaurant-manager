import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
  addLineSchema,
  openCheckSchema,
  updateLineSchema,
  type AddLineInput,
  type OpenCheckInput,
  type UpdateLineInput,
} from "@rms/shared";
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

  @Get("checks/:checkId")
  @OrgRoles("STAFF")
  async get(@Param("restaurantId") restaurantId: string, @Param("checkId") checkId: string) {
    return { check: await this.checks.get(restaurantId, checkId) };
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
