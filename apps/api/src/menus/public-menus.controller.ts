import { Controller, Get, Param, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { MenusService } from "./menus.service";

@Controller("public/restaurants")
export class PublicMenusController {
  constructor(private readonly menus: MenusService) {}

  @Get(":slug/menus")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async publicMenus(@Param("slug") slug: string, @Query("at") at?: string) {
    const date = at ? new Date(at) : undefined;
    return this.menus.publicMenus(slug, date && !Number.isNaN(date.getTime()) ? date : undefined);
  }
}
