import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { DatabaseModule } from "@src/infra/database/database.module";
import { CredentialPublicController } from "@src/modules/credential/api/public/credential-public.controller";
import { CredentialPublicIssueHandler } from "@src/modules/credential/application/public/handlers/credential-public-issue.handler";
import { CredentialPublicRevokeHandler } from "@src/modules/credential/application/public/handlers/credential-public-revoke.handler";
import { CredentialPublicVerifyHandler } from "@src/modules/credential/application/public/handlers/credential-public-verify.handler";
import { ICredentialRepository } from "@src/modules/credential/domain/credential.repository";
import { CredentialDataAccessObject } from "@src/modules/credential/infra/credential.data-access-object";
import { CredentialRepository } from "@src/modules/credential/infra/credential.repository";
import { VcModule } from "@src/modules/vc/vc.module";
import { WalletModule } from "@src/modules/wallet/wallet.module";
import { IssuerModule } from "@src/modules/issuer/issuer.module";

@Module({
  imports: [DatabaseModule, CqrsModule, IssuerModule, VcModule, WalletModule],
  controllers: [CredentialPublicController],
  providers: [
    CredentialPublicIssueHandler,
    CredentialPublicRevokeHandler,
    CredentialPublicVerifyHandler,
    CredentialDataAccessObject,
    { provide: ICredentialRepository, useClass: CredentialRepository },
  ],
  exports: [ICredentialRepository, CredentialDataAccessObject],
})
export class CredentialModule {}
