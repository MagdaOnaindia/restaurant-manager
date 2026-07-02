import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgsService } from "./orgs.service";
import { OrgsController } from "./orgs.controller";
import { RestaurantsService } from "./restaurants.service";
import { RestaurantsController } from "./restaurants.controller";
import { InvitationsController } from "./invitations.controller";
import { OrgRolesGuard } from "./org-roles.guard";

@Module({
  imports: [AuthModule],
  controllers: [OrgsController, RestaurantsController, InvitationsController],
  providers: [OrgsService, RestaurantsService, OrgRolesGuard],
  exports: [OrgsService, RestaurantsService, OrgRolesGuard],
})
export class OrgsModule {}
