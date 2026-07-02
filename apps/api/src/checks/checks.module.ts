import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgsModule } from "../orgs/orgs.module";
import { ChecksService } from "./checks.service";
import { ChecksController } from "./checks.controller";
import { CheckEventsService } from "./check-events.service";

@Module({
  imports: [AuthModule, OrgsModule],
  controllers: [ChecksController],
  providers: [ChecksService, CheckEventsService],
  exports: [ChecksService, CheckEventsService],
})
export class ChecksModule {}
