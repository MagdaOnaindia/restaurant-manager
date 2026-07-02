import { Module } from "@nestjs/common";
import { PaymentsModule } from "../payments/payments.module";
import { ChecksModule } from "../checks/checks.module";
import { SplitPayService } from "./split-pay.service";
import { PayController } from "./pay.controller";
import { StripeWebhookController } from "../payments/webhook.controller";

@Module({
  imports: [PaymentsModule, ChecksModule],
  controllers: [PayController, StripeWebhookController],
  providers: [SplitPayService],
  exports: [SplitPayService],
})
export class SplitPayModule {}
