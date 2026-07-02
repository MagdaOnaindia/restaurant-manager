import { Injectable, NotFoundException } from "@nestjs/common";
import type { CreateRestaurantInput, RestaurantDetail, UpdateRestaurantInput } from "@rms/shared";
import type { Restaurant } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { shortCode, slugify } from "../common/slug";

function toDetail(r: Restaurant): RestaurantDetail {
  return {
    id: r.id,
    organizationId: r.organizationId,
    name: r.name,
    slug: r.slug,
    description: r.description,
    address: r.address,
    city: r.city,
    phone: r.phone,
    timezone: r.timezone,
    currency: r.currency,
    isPublic: r.isPublic,
  };
}

@Injectable()
export class RestaurantsService {
  constructor(private readonly prisma: PrismaService) {}

  private async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name) || "restaurante";
    let candidate = base;
    // Reintenta con sufijo aleatorio hasta encontrar hueco
    for (let attempt = 0; attempt < 10; attempt++) {
      const existing = await this.prisma.restaurant.findUnique({ where: { slug: candidate } });
      if (!existing) return candidate;
      candidate = `${base}-${shortCode(4)}`;
    }
    return `${base}-${shortCode(8)}`;
  }

  async create(orgId: string, input: CreateRestaurantInput): Promise<RestaurantDetail> {
    const restaurant = await this.prisma.restaurant.create({
      data: {
        organizationId: orgId,
        name: input.name,
        slug: await this.uniqueSlug(input.name),
        description: input.description,
        address: input.address,
        city: input.city,
        phone: input.phone,
      },
    });
    return toDetail(restaurant);
  }

  async list(orgId: string): Promise<RestaurantDetail[]> {
    const restaurants = await this.prisma.restaurant.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "asc" },
    });
    return restaurants.map(toDetail);
  }

  async get(restaurantId: string): Promise<RestaurantDetail> {
    const restaurant = await this.prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) throw new NotFoundException("Restaurante no encontrado");
    return toDetail(restaurant);
  }

  async update(restaurantId: string, input: UpdateRestaurantInput): Promise<RestaurantDetail> {
    const restaurant = await this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: input,
    });
    return toDetail(restaurant);
  }

  async remove(restaurantId: string) {
    await this.prisma.restaurant.delete({ where: { id: restaurantId } });
    return { ok: true };
  }
}
