import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgsModule } from "../orgs/orgs.module";
import { ReservationsService } from "./reservations.service";
import { ReservationsController } from "./reservations.controller";
import { PublicReservationsController } from "./public-reservations.controller";

@Module({
  imports: [AuthModule, OrgsModule],
  controllers: [ReservationsController, PublicReservationsController],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
