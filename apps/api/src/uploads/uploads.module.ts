import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgsModule } from "../orgs/orgs.module";
import { UploadsController } from "./uploads.controller";

@Module({
  imports: [AuthModule, OrgsModule],
  controllers: [UploadsController],
})
export class UploadsModule {}
