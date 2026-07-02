import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgsModule } from "../orgs/orgs.module";
import { ChecksService } from "./checks.service";
import { ChecksController } from "./checks.controller";

@Module({
  imports: [AuthModule, OrgsModule],
  controllers: [ChecksController],
  providers: [ChecksService],
  exports: [ChecksService],
})
export class ChecksModule {}
