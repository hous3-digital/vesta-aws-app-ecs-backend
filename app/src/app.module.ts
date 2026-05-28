import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { CqrsModule } from "@nestjs/cqrs";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { HealthController } from "@src/health.controller";
import { DatabaseModule } from "@src/infra/database/database.module";
import { EnvModule } from "@src/infra/env/env.module";
import { EgressModule } from "@src/infra/logging/egress/egress.module";
import { IngressModule } from "@src/infra/logging/ingress/ingress.module";
import { ChallengeModule } from "@src/modules/challenge/challenge.module";
import { CredentialModule } from "@src/modules/credential/credential.module";
import { ProofModule } from "@src/modules/proof/proof.module";
import { StellarModule } from "@src/modules/stellar/stellar.module";
import { VcModule } from "@src/modules/vc/vc.module";
import { ZkModule } from "@src/modules/zk/zk.module";
import { GlobalUnhandledException } from "@src/utils/subscribers/global-unhandled-exception";

@Module({
  imports: [
    EnvModule,
    CqrsModule,
    DatabaseModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    EgressModule,
    IngressModule,

    ChallengeModule,
    CredentialModule,
    ProofModule,
    StellarModule,
    VcModule,
    ZkModule,
  ],
  controllers: [HealthController],
  providers: [GlobalUnhandledException, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
