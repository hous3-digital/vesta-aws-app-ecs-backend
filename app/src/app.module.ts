import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { JwtModule } from "@nestjs/jwt";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule } from "@nestjs/throttler";
import { DatabaseModule } from "@src/infra/database/database.module";
import { EnvModule } from "@src/infra/env/env.module";
import { EgressModule } from "@src/infra/logging/egress/egress.module";
import { IngressModule } from "@src/infra/logging/ingress/ingress.module";
import { AuthModule } from "@src/modules/auth/auth.module";
import { FileModule } from "@src/modules/file/file.module";
import { UserModule } from "@src/modules/user/user.module";
import { GlobalUnhandledException } from "@src/utils/subscribers/global-unhandled-exception";

@Module({
  imports: [
    EnvModule,
    CqrsModule,
    JwtModule,
    DatabaseModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),
    ScheduleModule.forRoot(),

    AuthModule,
    EgressModule,
    FileModule,
    IngressModule,
    UserModule,
  ],
  providers: [GlobalUnhandledException],
})
export class AppModule {}
