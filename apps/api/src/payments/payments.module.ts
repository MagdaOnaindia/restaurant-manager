import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgsModule } from "../orgs/orgs.module";
import { StripeService } from "./stripe.service";
import { ConnectController } from "./connect.controller";
import { StripeWebhookController } from "./webhook.controller";

@Module({
  imports: [AuthModule, OrgsModule],
  controllers: [ConnectController, StripeWebhookController],
  providers: [StripeService],
  exports: [StripeService],
})
export class PaymentsModule {}
