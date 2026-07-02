import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from "@nestjs/common";
import {
  createCategorySchema,
  createItemSchema,
  createMenuSchema,
  setSchedulesSchema,
  updateCategorySchema,
  updateItemSchema,
  updateMenuSchema,
  type CreateCategoryInput,
  type CreateItemInput,
  type CreateMenuInput,
  type SetSchedulesInput,
  type UpdateCategoryInput,
  type UpdateItemInput,
  type UpdateMenuInput,
} from "@rms/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OrgRoles, OrgRolesGuard } from "../orgs/org-roles.guard";
import { MenusService } from "./menus.service";

function parseAt(at?: string): Date | undefined {
  if (!at) return undefined;
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

@Controller("restaurants/:restaurantId")
@UseGuards(JwtAuthGuard, OrgRolesGuard)
export class MenusController {
  constructor(private readonly menus: MenusService) {}

  // ── Menús ────────────────────────────────────────────────────────

  @Get("menus")
  @OrgRoles("STAFF")
  async list(@Param("restaurantId") restaurantId: string, @Query("at") at?: string) {
    return { menus: await this.menus.list(restaurantId, parseAt(at)) };
  }

  @Get("menus/active")
  @OrgRoles("STAFF")
  async active(@Param("restaurantId") restaurantId: string, @Query("at") at?: string) {
    return { menus: await this.menus.activeMenus(restaurantId, parseAt(at)) };
  }

  @Post("menus")
  @OrgRoles("MANAGER")
  async create(
    @Param("restaurantId") restaurantId: string,
    @Body(new ZodValidationPipe(createMenuSchema)) body: CreateMenuInput,
  ) {
    return { menu: await this.menus.create(restaurantId, body) };
  }

  @Get("menus/:menuId")
  @OrgRoles("STAFF")
  async get(@Param("restaurantId") restaurantId: string, @Param("menuId") menuId: string) {
    return { menu: await this.menus.get(restaurantId, menuId) };
  }

  @Patch("menus/:menuId")
  @OrgRoles("MANAGER")
  async update(
    @Param("restaurantId") restaurantId: string,
    @Param("menuId") menuId: string,
    @Body(new ZodValidationPipe(updateMenuSchema)) body: UpdateMenuInput,
  ) {
    return { menu: await this.menus.update(restaurantId, menuId, body) };
  }

  @Delete("menus/:menuId")
  @OrgRoles("MANAGER")
  async remove(@Param("restaurantId") restaurantId: string, @Param("menuId") menuId: string) {
    return this.menus.remove(restaurantId, menuId);
  }

  @Post("menus/:menuId/duplicate")
  @OrgRoles("MANAGER")
  async duplicate(@Param("restaurantId") restaurantId: string, @Param("menuId") menuId: string) {
    return { menu: await this.menus.duplicate(restaurantId, menuId) };
  }

  @Put("menus/:menuId/schedules")
  @OrgRoles("MANAGER")
  async setSchedules(
    @Param("restaurantId") restaurantId: string,
    @Param("menuId") menuId: string,
    @Body(new ZodValidationPipe(setSchedulesSchema)) body: SetSchedulesInput,
  ) {
    return { menu: await this.menus.setSchedules(restaurantId, menuId, body.schedules) };
  }

  // ── Categorías ───────────────────────────────────────────────────

  @Post("menus/:menuId/categories")
  @OrgRoles("MANAGER")
  async createCategory(
    @Param("restaurantId") restaurantId: string,
    @Param("menuId") menuId: string,
    @Body(new ZodValidationPipe(createCategorySchema)) body: CreateCategoryInput,
  ) {
    return { category: await this.menus.createCategory(restaurantId, menuId, body) };
  }

  @Patch("categories/:categoryId")
  @OrgRoles("MANAGER")
  async updateCategory(
    @Param("restaurantId") restaurantId: string,
    @Param("categoryId") categoryId: string,
    @Body(new ZodValidationPipe(updateCategorySchema)) body: UpdateCategoryInput,
  ) {
    return { category: await this.menus.updateCategory(restaurantId, categoryId, body) };
  }

  @Delete("categories/:categoryId")
  @OrgRoles("MANAGER")
  async removeCategory(
    @Param("restaurantId") restaurantId: string,
    @Param("categoryId") categoryId: string,
  ) {
    return this.menus.removeCategory(restaurantId, categoryId);
  }

  // ── Platos ───────────────────────────────────────────────────────

  @Post("categories/:categoryId/items")
  @OrgRoles("MANAGER")
  async createItem(
    @Param("restaurantId") restaurantId: string,
    @Param("categoryId") categoryId: string,
    @Body(new ZodValidationPipe(createItemSchema)) body: CreateItemInput,
  ) {
    return { item: await this.menus.createItem(restaurantId, categoryId, body) };
  }

  @Patch("items/:itemId")
  @OrgRoles("MANAGER")
  async updateItem(
    @Param("restaurantId") restaurantId: string,
    @Param("itemId") itemId: string,
    @Body(new ZodValidationPipe(updateItemSchema)) body: UpdateItemInput,
  ) {
    return { item: await this.menus.updateItem(restaurantId, itemId, body) };
  }

  @Delete("items/:itemId")
  @OrgRoles("MANAGER")
  async removeItem(@Param("restaurantId") restaurantId: string, @Param("itemId") itemId: string) {
    return this.menus.removeItem(restaurantId, itemId);
  }
}
