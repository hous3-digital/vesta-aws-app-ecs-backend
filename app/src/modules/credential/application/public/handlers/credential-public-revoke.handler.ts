import { Injectable, NotFoundException } from "@nestjs/common";
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
export class CredentialPublicRevokeHandler implements ICommandHandler<CredentialPublicRevokeCommand, CredentialRevokeResult> {
  public constructor(private readonly credentialRepository: ICredentialRepository) {}

  public async execute(command: CredentialPublicRevokeCommand): Promise<CredentialRevokeResult> {
    const credential = await this.credentialRepository.findByVcHash(command.vcHash);

    if (!credential) {
      throw new NotFoundException(`Credencial não encontrada: ${command.vcHash}`);
    }

    credential.revoke();
    await this.credentialRepository.updateOrThrow(credential);

    return {
      success: true,
      vcHash: command.vcHash,
      status: credential.status,
      reason: command.reason ?? null,
    };
  }
}
