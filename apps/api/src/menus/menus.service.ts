import { Injectable, NotFoundException } from "@nestjs/common";
import {
  isMenuActiveNow,
  type CreateCategoryInput,
  type CreateItemInput,
  type CreateMenuInput,
  type MenuDetail,
  type MenuScheduleInfo,
  type MenuScheduleInput,
  type MenuSummary,
  type UpdateCategoryInput,
  type UpdateItemInput,
  type UpdateMenuInput,
} from "@rms/shared";
import type { Menu, MenuCategory, MenuItem, MenuSchedule } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type MenuWithAll = Menu & {
  schedules: MenuSchedule[];
  categories: (MenuCategory & { items: MenuItem[] })[];
};

function scheduleInfo(s: MenuSchedule): MenuScheduleInfo {
  return {
    id: s.id,
    dateFrom: s.dateFrom ? s.dateFrom.toISOString().slice(0, 10) : null,
    dateTo: s.dateTo ? s.dateTo.toISOString().slice(0, 10) : null,
    daysOfWeek: s.daysOfWeek,
    timeFrom: s.timeFrom,
    timeTo: s.timeTo,
  };
}

function toDetail(menu: MenuWithAll): MenuDetail {
  return {
    id: menu.id,
    name: menu.name,
    description: menu.description,
    type: menu.type,
    status: menu.status,
    priceCents: menu.priceCents,
    schedules: menu.schedules.map(scheduleInfo),
    categories: menu.categories.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      sortOrder: c.sortOrder,
      choiceCount: c.choiceCount,
      items: c.items.map((i) => ({
        id: i.id,
        name: i.name,
        description: i.description,
        priceCents: i.priceCents,
        photoUrl: i.photoUrl,
        allergens: i.allergens,
        tags: i.tags,
        isAvailable: i.isAvailable,
        sortOrder: i.sortOrder,
      })),
    })),
  };
}

const FULL_INCLUDE = {
  schedules: true,
  categories: {
    orderBy: [{ sortOrder: "asc" as const }, { name: "asc" as const }],
    include: { items: { orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }] } },
  },
};

@Injectable()
export class MenusService {
  constructor(private readonly prisma: PrismaService) {}

  private async restaurantOf(restaurantId: string) {
    const restaurant = await this.prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) throw new NotFoundException("Restaurante no encontrado");
    return restaurant;
  }

  private async menuOf(restaurantId: string, menuId: string) {
    const menu = await this.prisma.menu.findFirst({ where: { id: menuId, restaurantId } });
    if (!menu) throw new NotFoundException("Menú no encontrado");
    return menu;
  }

  // ── Menus ────────────────────────────────────────────────────────

  async list(restaurantId: string, at?: Date): Promise<MenuSummary[]> {
    const restaurant = await this.restaurantOf(restaurantId);
    const now = at ?? new Date();
    const menus = await this.prisma.menu.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "asc" },
      include: {
        schedules: true,
        categories: { include: { _count: { select: { items: true } } } },
      },
    });
    return menus.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      type: m.type,
      status: m.status,
      priceCents: m.priceCents,
      schedules: m.schedules.map(scheduleInfo),
      categoryCount: m.categories.length,
      itemCount: m.categories.reduce((acc, c) => acc + c._count.items, 0),
      activeNow:
        m.status === "PUBLISHED" &&
        isMenuActiveNow({ schedules: m.schedules.map(scheduleInfo) }, now, restaurant.timezone),
    }));
  }

  async create(restaurantId: string, input: CreateMenuInput) {
    await this.restaurantOf(restaurantId);
    return this.prisma.menu.create({
      data: {
        restaurantId,
        name: input.name,
        type: input.type,
        description: input.description,
        priceCents: input.type === "FIXED_PRICE" ? (input.priceCents ?? 0) : null,
      },
    });
  }

  async get(restaurantId: string, menuId: string): Promise<MenuDetail> {
    const menu = await this.prisma.menu.findFirst({
      where: { id: menuId, restaurantId },
      include: FULL_INCLUDE,
    });
    if (!menu) throw new NotFoundException("Menú no encontrado");
    return toDetail(menu as MenuWithAll);
  }

  async update(restaurantId: string, menuId: string, input: UpdateMenuInput) {
    await this.menuOf(restaurantId, menuId);
    await this.prisma.menu.update({ where: { id: menuId }, data: input });
    return this.get(restaurantId, menuId);
  }

  async remove(restaurantId: string, menuId: string) {
    await this.menuOf(restaurantId, menuId);
    await this.prisma.menu.delete({ where: { id: menuId } });
    return { ok: true };
  }

  async duplicate(restaurantId: string, menuId: string) {
    const source = await this.prisma.menu.findFirst({
      where: { id: menuId, restaurantId },
      include: {
        schedules: true,
        categories: {
          orderBy: { sortOrder: "asc" },
          include: {
            items: {
              orderBy: { sortOrder: "asc" },
              include: { modifierGroups: { include: { modifiers: true } } },
            },
          },
        },
      },
    });
    if (!source) throw new NotFoundException("Menú no encontrado");

    return this.prisma.menu.create({
      data: {
        restaurantId,
        name: `${source.name} (copia)`,
        description: source.description,
        type: source.type,
        status: "DRAFT",
        priceCents: source.priceCents,
        schedules: {
          create: source.schedules.map((s) => ({
            dateFrom: s.dateFrom,
            dateTo: s.dateTo,
            daysOfWeek: s.daysOfWeek,
            timeFrom: s.timeFrom,
            timeTo: s.timeTo,
          })),
        },
        categories: {
          create: source.categories.map((c) => ({
            name: c.name,
            description: c.description,
            sortOrder: c.sortOrder,
            choiceCount: c.choiceCount,
            items: {
              create: c.items.map((i) => ({
                name: i.name,
                description: i.description,
                priceCents: i.priceCents,
                photoUrl: i.photoUrl,
                allergens: i.allergens,
                tags: i.tags,
                isAvailable: i.isAvailable,
                sortOrder: i.sortOrder,
                modifierGroups: {
                  create: i.modifierGroups.map((g) => ({
                    name: g.name,
                    minSelect: g.minSelect,
                    maxSelect: g.maxSelect,
                    sortOrder: g.sortOrder,
                    modifiers: {
                      create: g.modifiers.map((mo) => ({
                        name: mo.name,
                        priceCents: mo.priceCents,
                        sortOrder: mo.sortOrder,
                      })),
                    },
                  })),
                },
              })),
            },
          })),
        },
      },
    });
  }

  async setSchedules(restaurantId: string, menuId: string, schedules: MenuScheduleInput[]) {
    await this.menuOf(restaurantId, menuId);
    await this.prisma.$transaction([
      this.prisma.menuSchedule.deleteMany({ where: { menuId } }),
      this.prisma.menuSchedule.createMany({
        data: schedules.map((s) => ({
          menuId,
          dateFrom: s.dateFrom ? new Date(s.dateFrom) : null,
          dateTo: s.dateTo ? new Date(s.dateTo) : null,
          daysOfWeek: s.daysOfWeek,
          timeFrom: s.timeFrom ?? null,
          timeTo: s.timeTo ?? null,
        })),
      }),
    ]);
    return this.get(restaurantId, menuId);
  }

  // ── Categories ───────────────────────────────────────────────────

  async createCategory(restaurantId: string, menuId: string, input: CreateCategoryInput) {
    await this.menuOf(restaurantId, menuId);
    const last = await this.prisma.menuCategory.findFirst({
      where: { menuId },
      orderBy: { sortOrder: "desc" },
    });
    return this.prisma.menuCategory.create({
      data: {
        menuId,
        name: input.name,
        description: input.description,
        choiceCount: input.choiceCount,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    });
  }

  private async categoryOf(restaurantId: string, categoryId: string) {
    const category = await this.prisma.menuCategory.findFirst({
      where: { id: categoryId, menu: { restaurantId } },
    });
    if (!category) throw new NotFoundException("Categoría no encontrada");
    return category;
  }

  async updateCategory(restaurantId: string, categoryId: string, input: UpdateCategoryInput) {
    await this.categoryOf(restaurantId, categoryId);
    return this.prisma.menuCategory.update({ where: { id: categoryId }, data: input });
  }

  async removeCategory(restaurantId: string, categoryId: string) {
    await this.categoryOf(restaurantId, categoryId);
    await this.prisma.menuCategory.delete({ where: { id: categoryId } });
    return { ok: true };
  }

  // ── Dishes ───────────────────────────────────────────────────────

  async createItem(restaurantId: string, categoryId: string, input: CreateItemInput) {
    await this.categoryOf(restaurantId, categoryId);
    const last = await this.prisma.menuItem.findFirst({
      where: { categoryId },
      orderBy: { sortOrder: "desc" },
    });
    return this.prisma.menuItem.create({
      data: {
        categoryId,
        name: input.name,
        description: input.description,
        priceCents: input.priceCents,
        allergens: input.allergens,
        tags: input.tags,
        isAvailable: input.isAvailable,
        photoUrl: input.photoUrl ?? null,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    });
  }

  private async itemOf(restaurantId: string, itemId: string) {
    const item = await this.prisma.menuItem.findFirst({
      where: { id: itemId, category: { menu: { restaurantId } } },
    });
    if (!item) throw new NotFoundException("Plato no encontrado");
    return item;
  }

  async updateItem(restaurantId: string, itemId: string, input: UpdateItemInput) {
    await this.itemOf(restaurantId, itemId);
    return this.prisma.menuItem.update({ where: { id: itemId }, data: input });
  }

  async removeItem(restaurantId: string, itemId: string) {
    await this.itemOf(restaurantId, itemId);
    await this.prisma.menuItem.delete({ where: { id: itemId } });
    return { ok: true };
  }

  // ── Active menus (waiter view and public page) ───────────────────

  async activeMenus(restaurantId: string, at?: Date): Promise<MenuDetail[]> {
    const restaurant = await this.restaurantOf(restaurantId);
    const now = at ?? new Date();
    const menus = await this.prisma.menu.findMany({
      where: { restaurantId, status: "PUBLISHED" },
      orderBy: { createdAt: "asc" },
      include: FULL_INCLUDE,
    });
    return menus
      .filter((m) =>
        isMenuActiveNow({ schedules: m.schedules.map(scheduleInfo) }, now, restaurant.timezone),
      )
      .map((m) => toDetail(m as MenuWithAll));
  }

  async publicMenus(slug: string, at?: Date) {
    const restaurant = await this.prisma.restaurant.findUnique({ where: { slug } });
    if (!restaurant || !restaurant.isPublic) {
      throw new NotFoundException("Restaurante no encontrado");
    }
    const menus = await this.activeMenus(restaurant.id, at);
    return {
      restaurant: {
        name: restaurant.name,
        slug: restaurant.slug,
        description: restaurant.description,
        address: restaurant.address,
        city: restaurant.city,
        phone: restaurant.phone,
        currency: restaurant.currency,
      },
      menus,
    };
  }
}
