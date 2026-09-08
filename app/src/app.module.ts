import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { CqrsModule } from "@nestjs/cqrs";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { HealthController } from "@src/health.controller";
import { AuthModule } from "@src/infra/auth/auth.module";
import { ApiKeyGuard } from "@src/infra/auth/api-key.guard";
import { DatabaseModule } from "@src/infra/database/database.module";
import { EnvModule } from "@src/infra/env/env.module";
import { EgressModule } from "@src/infra/logging/egress/egress.module";
import { IngressModule } from "@src/infra/logging/ingress/ingress.module";
import { BackofficeModule } from "@src/modules/backoffice/backoffice.module";
import { ChallengeModule } from "@src/modules/challenge/challenge.module";
import { CommissionModule } from "@src/modules/commission/commission.module";
import { CredentialModule } from "@src/modules/credential/credential.module";
import { IssuerModule } from "@src/modules/issuer/issuer.module";
import { ProofModule } from "@src/modules/proof/proof.module";
import { StellarModule } from "@src/modules/stellar/stellar.module";
import { VcModule } from "@src/modules/vc/vc.module";
import { WalletModule } from "@src/modules/wallet/wallet.module";
import { ZkModule } from "@src/modules/zk/zk.module";
import { GlobalUnhandledException } from "@src/utils/subscribers/global-unhandled-exception";

@Module({
  imports: [
    EnvModule,
    CqrsModule,
    DatabaseModule,
    AuthModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    EgressModule,
    IngressModule,

    BackofficeModule,
    ChallengeModule,
    CommissionModule,
    CredentialModule,
    IssuerModule,
    ProofModule,
    StellarModule,
    VcModule,
    WalletModule,
    ZkModule,
  ],
  controllers: [HealthController],
  providers: [
    GlobalUnhandledException,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: ApiKeyGuard },
  ],
})
export class AppModule {}
