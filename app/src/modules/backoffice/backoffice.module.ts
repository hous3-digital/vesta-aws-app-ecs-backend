import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { DatabaseModule } from "@src/infra/database/database.module";
import { EnvModule } from "@src/infra/env/env.module";
import { IssuerModule } from "@src/modules/issuer/issuer.module";

import { CommissionsBackofficeController } from "@src/modules/backoffice/commissions/api/commissions-backoffice.controller";
import { CommissionBalanceHandler } from "@src/modules/backoffice/commissions/application/handlers/commission-balance.handler";
import { CommissionKpisHandler } from "@src/modules/backoffice/commissions/application/handlers/commission-kpis.handler";
import { CommissionPendingHandler } from "@src/modules/backoffice/commissions/application/handlers/commission-pending.handler";
import { CommissionSummaryHandler } from "@src/modules/backoffice/commissions/application/handlers/commission-summary.handler";
import { CommissionTimeseriesHandler } from "@src/modules/backoffice/commissions/application/handlers/commission-timeseries.handler";

import { CredentialsBackofficeController } from "@src/modules/backoffice/credentials/api/credentials-backoffice.controller";
import { CredentialDetailHandler } from "@src/modules/backoffice/credentials/application/handlers/credential-detail.handler";
import { CredentialListHandler } from "@src/modules/backoffice/credentials/application/handlers/credential-list.handler";
import { CredentialsBackofficeDao } from "@src/modules/backoffice/credentials/infra/credentials-backoffice.dao";

import { VerificationsBackofficeController } from "@src/modules/backoffice/verifications/api/verifications-backoffice.controller";
import { VerificationDetailHandler } from "@src/modules/backoffice/verifications/application/handlers/verification-detail.handler";
import { VerificationExportHandler } from "@src/modules/backoffice/verifications/application/handlers/verification-export.handler";
import { VerificationListHandler } from "@src/modules/backoffice/verifications/application/handlers/verification-list.handler";
import { VerificationsBackofficeDao } from "@src/modules/backoffice/verifications/infra/verifications-backoffice.dao";

import { VerifiersBackofficeController } from "@src/modules/backoffice/verifiers/api/verifiers-backoffice.controller";
import { VerifierCreateHandler } from "@src/modules/backoffice/verifiers/application/handlers/verifier-create.handler";
import { VerifierListHandler } from "@src/modules/backoffice/verifiers/application/handlers/verifier-list.handler";
import { VerifierUpdateStatusHandler } from "@src/modules/backoffice/verifiers/application/handlers/verifier-update-status.handler";
import { IVerifierRepository } from "@src/modules/backoffice/verifiers/domain/verifier.repository";
import { VerifierRepository } from "@src/modules/backoffice/verifiers/infra/verifier.repository";
import { BackofficeProfileController } from "@src/modules/backoffice/profile/api/backoffice-profile.controller";
import { BackofficeProfileHandler } from "@src/modules/backoffice/profile/application/handlers/backoffice-profile.handler";
import { ApiKeysBackofficeController } from "@src/modules/backoffice/api-keys/api/api-keys-backoffice.controller";

@Module({
  imports: [DatabaseModule, EnvModule, IssuerModule, CqrsModule],
  controllers: [
    ApiKeysBackofficeController,
    BackofficeProfileController,
    CommissionsBackofficeController,
    CredentialsBackofficeController,
    VerificationsBackofficeController,
    VerifiersBackofficeController,
  ],
  providers: [
    BackofficeProfileHandler,
    CommissionBalanceHandler,
    CommissionKpisHandler,
    CommissionPendingHandler,
    CommissionSummaryHandler,
    CommissionTimeseriesHandler,

    CredentialDetailHandler,
    CredentialListHandler,
    CredentialsBackofficeDao,

    VerificationDetailHandler,
    VerificationExportHandler,
    VerificationListHandler,
    VerificationsBackofficeDao,

    VerifierCreateHandler,
    VerifierListHandler,
    VerifierUpdateStatusHandler,
    { provide: IVerifierRepository, useClass: VerifierRepository },
  ],
})
export class BackofficeModule {}
