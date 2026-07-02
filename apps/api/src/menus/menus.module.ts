import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgsModule } from "../orgs/orgs.module";
import { MenusService } from "./menus.service";
import { MenusController } from "./menus.controller";
import { PublicMenusController } from "./public-menus.controller";

@Module({
  imports: [AuthModule, OrgsModule],
  controllers: [MenusController, PublicMenusController],
  providers: [MenusService],
  exports: [MenusService],
})
export class MenusModule {}
