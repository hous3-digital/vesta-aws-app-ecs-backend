import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { DatabaseModule } from "@src/infra/database/database.module";
import { ChallengeModule } from "@src/modules/challenge/challenge.module";
import { CredentialModule } from "@src/modules/credential/credential.module";
import { StellarModule } from "@src/modules/stellar/stellar.module";
import { VcModule } from "@src/modules/vc/vc.module";
import { ZkModule } from "@src/modules/zk/zk.module";
import { ProofPublicController } from "@src/modules/proof/api/public/proof-public.controller";
import { ProofPublicGenerateAndSubmitHandler } from "@src/modules/proof/application/public/handlers/proof-public-generate-and-submit.handler";
import { ProofPublicSubmitHandler } from "@src/modules/proof/application/public/handlers/proof-public-submit.handler";
import { IAttestationRepository } from "@src/modules/proof/domain/attestation.repository";
import { AttestationRepository } from "@src/modules/proof/infra/attestation.repository";

@Module({
  imports: [DatabaseModule, CqrsModule, VcModule, ZkModule, StellarModule, ChallengeModule, CredentialModule],
  controllers: [ProofPublicController],
  providers: [
    ProofPublicGenerateAndSubmitHandler,
    ProofPublicSubmitHandler,
    { provide: IAttestationRepository, useClass: AttestationRepository },
  ],
})
export class ProofModule {}
