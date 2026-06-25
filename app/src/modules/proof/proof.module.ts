import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { DatabaseModule } from "@src/infra/database/database.module";
import { EnvModule } from "@src/infra/env/env.module";
import { ChallengeModule } from "@src/modules/challenge/challenge.module";
import { CredentialModule } from "@src/modules/credential/credential.module";
import { IssuerModule } from "@src/modules/issuer/issuer.module";
import { StellarModule } from "@src/modules/stellar/stellar.module";
import { VcModule } from "@src/modules/vc/vc.module";
import { WalletModule } from "@src/modules/wallet/wallet.module";
import { ZkModule } from "@src/modules/zk/zk.module";
import { ProofPublicController } from "@src/modules/proof/api/public/proof-public.controller";
import { ProofPublicPrepareHandler } from "@src/modules/proof/application/public/handlers/proof-public-prepare.handler";
import { ProofPublicSubmitHandler } from "@src/modules/proof/application/public/handlers/proof-public-submit.handler";
import { ProofPublicSubmitSignedHandler } from "@src/modules/proof/application/public/handlers/proof-public-submit-signed.handler";
import { PrepareSessionService } from "@src/modules/proof/application/services/prepare-session.service";
import { IAttestationRepository } from "@src/modules/proof/domain/attestation.repository";
import { AttestationRepository } from "@src/modules/proof/infra/attestation.repository";

@Module({
  imports: [
    DatabaseModule,
    CqrsModule,
    EnvModule,
    VcModule,
    ZkModule,
    StellarModule,
    ChallengeModule,
    CredentialModule,
    IssuerModule,
    WalletModule,
  ],
  controllers: [ProofPublicController],
  providers: [
    ProofPublicPrepareHandler,
    ProofPublicSubmitSignedHandler,
    ProofPublicSubmitHandler,
    PrepareSessionService,
    { provide: IAttestationRepository, useClass: AttestationRepository },
  ],
})
export class ProofModule {}
