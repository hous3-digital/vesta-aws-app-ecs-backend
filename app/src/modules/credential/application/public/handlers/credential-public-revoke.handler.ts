import { Injectable, Logger } from "@nestjs/common";
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { CredentialPublicRevokeCommand } from "@src/modules/credential/application/public/commands/credential-public-revoke.command";
import { ICredentialRepository } from "@src/modules/credential/domain/credential.repository";

export interface CredentialRevokeResult {
  success: boolean;
  vcHash: string;
  status: string;
  reason: string | null;
}

@Injectable()
@CommandHandler(CredentialPublicRevokeCommand)
export class CredentialPublicRevokeHandler implements ICommandHandler<
  CredentialPublicRevokeCommand,
  CredentialRevokeResult
> {
  private readonly logger = new Logger(CredentialPublicRevokeHandler.name);

  public constructor(private readonly credentialRepository: ICredentialRepository) {}

  public async execute(command: CredentialPublicRevokeCommand): Promise<CredentialRevokeResult> {
    const credential = await this.credentialRepository.findByVcHashForIssuerOrThrow(command.vcHash, command.issuerId);
    credential.revoke();
    await this.credentialRepository.updateOrThrow(credential);

    this.logger.log(`Credential revoked: ${credential.id.value} of issuer ${command.issuerId}`);
    return {
      success: true,
      vcHash: command.vcHash,
      status: credential.status,
      reason: command.reason ?? null,
    };
  }
}
