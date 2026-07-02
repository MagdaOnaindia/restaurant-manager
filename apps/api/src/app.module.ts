import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { PrismaModule } from "./prisma/prisma.module";
import { MailModule } from "./mail/mail.module";
import { AuthModule } from "./auth/auth.module";
import { OrgsModule } from "./orgs/orgs.module";
import { TablesModule } from "./tables/tables.module";
import { MenusModule } from "./menus/menus.module";
import { UploadsModule } from "./uploads/uploads.module";
import { ReservationsModule } from "./reservations/reservations.module";
import { ChecksModule } from "./checks/checks.module";
import { PaymentsModule } from "./payments/payments.module";
import { SplitPayModule } from "./split-pay/split-pay.module";
import { HealthController } from "./health/health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    MailModule,
    AuthModule,
    OrgsModule,
    TablesModule,
    MenusModule,
    UploadsModule,
    ReservationsModule,
    ChecksModule,
    PaymentsModule,
    SplitPayModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
