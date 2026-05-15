import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { ThrottlerModule } from "@nestjs/throttler";
import { HealthController } from "@src/health.controller";
import { DatabaseModule } from "@src/infra/database/database.module";
import { EnvModule } from "@src/infra/env/env.module";
import { EgressModule } from "@src/infra/logging/egress/egress.module";
import { IngressModule } from "@src/infra/logging/ingress/ingress.module";
import { GlobalUnhandledException } from "@src/utils/subscribers/global-unhandled-exception";

@Module({
  imports: [
    EnvModule,
    CqrsModule,
    DatabaseModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),
    EgressModule,
    IngressModule,
  ],
  controllers: [HealthController],
  providers: [GlobalUnhandledException],
})
export class AppModule {}
