import { Body, Controller, Delete, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { updateRestaurantSchema, type UpdateRestaurantInput } from "@rms/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OrgRoles, OrgRolesGuard } from "./org-roles.guard";
import { RestaurantsService } from "./restaurants.service";

@Controller("restaurants")
@UseGuards(JwtAuthGuard, OrgRolesGuard)
export class RestaurantsController {
  constructor(private readonly restaurants: RestaurantsService) {}

  @Get(":restaurantId")
  @OrgRoles("STAFF")
  async get(@Param("restaurantId") restaurantId: string) {
    return { restaurant: await this.restaurants.get(restaurantId) };
  }

  @Patch(":restaurantId")
  @OrgRoles("MANAGER")
  async update(
    @Param("restaurantId") restaurantId: string,
    @Body(new ZodValidationPipe(updateRestaurantSchema)) body: UpdateRestaurantInput,
  ) {
    return { restaurant: await this.restaurants.update(restaurantId, body) };
  }

  @Delete(":restaurantId")
  @OrgRoles("ADMIN")
  async remove(@Param("restaurantId") restaurantId: string) {
    return this.restaurants.remove(restaurantId);
  }
}
