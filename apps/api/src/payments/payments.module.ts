import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgsModule } from "../orgs/orgs.module";
import { StripeService } from "./stripe.service";
import { ConnectController } from "./connect.controller";

// The webhook receiver lives in SplitPayModule (it needs SplitPayService).
@Module({
  imports: [AuthModule, OrgsModule],
  controllers: [ConnectController],
  providers: [StripeService],
  exports: [StripeService],
})
export class PaymentsModule {}
