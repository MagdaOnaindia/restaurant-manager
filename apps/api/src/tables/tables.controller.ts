import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
  createTableSchema,
  createZoneSchema,
  updateTableSchema,
  updateZoneSchema,
  type CreateTableInput,
  type CreateZoneInput,
  type UpdateTableInput,
  type UpdateZoneInput,
} from "@rms/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OrgRoles, OrgRolesGuard } from "../orgs/org-roles.guard";
import { TablesService } from "./tables.service";

@Controller("restaurants/:restaurantId")
@UseGuards(JwtAuthGuard, OrgRolesGuard)
export class TablesController {
  constructor(private readonly tables: TablesService) {}

  @Get("zones")
  @OrgRoles("STAFF")
  async listZones(@Param("restaurantId") restaurantId: string) {
    return { zones: await this.tables.listZones(restaurantId) };
  }

  @Post("zones")
  @OrgRoles("MANAGER")
  async createZone(
    @Param("restaurantId") restaurantId: string,
    @Body(new ZodValidationPipe(createZoneSchema)) body: CreateZoneInput,
  ) {
    return { zone: await this.tables.createZone(restaurantId, body) };
  }

  @Patch("zones/:zoneId")
  @OrgRoles("MANAGER")
  async updateZone(
    @Param("restaurantId") restaurantId: string,
    @Param("zoneId") zoneId: string,
    @Body(new ZodValidationPipe(updateZoneSchema)) body: UpdateZoneInput,
  ) {
    return { zone: await this.tables.updateZone(restaurantId, zoneId, body) };
  }

  @Delete("zones/:zoneId")
  @OrgRoles("MANAGER")
  async removeZone(@Param("restaurantId") restaurantId: string, @Param("zoneId") zoneId: string) {
    return this.tables.removeZone(restaurantId, zoneId);
  }

  @Post("zones/:zoneId/tables")
  @OrgRoles("MANAGER")
  async createTable(
    @Param("restaurantId") restaurantId: string,
    @Param("zoneId") zoneId: string,
    @Body(new ZodValidationPipe(createTableSchema)) body: CreateTableInput,
  ) {
    return { table: await this.tables.createTable(restaurantId, zoneId, body) };
  }

  @Patch("tables/:tableId")
  @OrgRoles("MANAGER")
  async updateTable(
    @Param("restaurantId") restaurantId: string,
    @Param("tableId") tableId: string,
    @Body(new ZodValidationPipe(updateTableSchema)) body: UpdateTableInput,
  ) {
    return { table: await this.tables.updateTable(restaurantId, tableId, body) };
  }

  @Delete("tables/:tableId")
  @OrgRoles("MANAGER")
  async removeTable(@Param("restaurantId") restaurantId: string, @Param("tableId") tableId: string) {
    return this.tables.removeTable(restaurantId, tableId);
  }
}
