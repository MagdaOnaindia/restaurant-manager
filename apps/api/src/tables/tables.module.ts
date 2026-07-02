import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgsModule } from "../orgs/orgs.module";
import { TablesService } from "./tables.service";
import { TablesController } from "./tables.controller";

@Module({
  imports: [AuthModule, OrgsModule],
  controllers: [TablesController],
  providers: [TablesService],
  exports: [TablesService],
})
export class TablesModule {}
