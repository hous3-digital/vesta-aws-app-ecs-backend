import { createHmac } from "crypto";
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { EnvService } from "@src/infra/env/env.service";
import { CredentialPublicKycStatusCommand } from "@src/modules/credential/application/public/commands/credential-public-kyc-status.command";
import { ICredentialRepository } from "@src/modules/credential/domain/credential.repository";

export interface CredentialKycStatusResult {
  updated: boolean;
  credentialId: string;
  status: string;
  kycLevel: string;
}

@Injectable()
@CommandHandler(CredentialPublicKycStatusCommand)
export class CredentialPublicKycStatusHandler
  implements ICommandHandler<CredentialPublicKycStatusCommand, CredentialKycStatusResult>
{
  private readonly logger = new Logger(CredentialPublicKycStatusHandler.name);

  public constructor(
    private readonly credentialRepository: ICredentialRepository,
    private readonly envService: EnvService,
  ) {}

  public async execute(
    command: CredentialPublicKycStatusCommand,
  ): Promise<CredentialKycStatusResult> {
    const cpfDedupKey = createHmac("sha256", this.envService.CPF_HMAC_SECRET)
      .update(command.cpf)
      .digest("hex");

    const credential = await this.credentialRepository.findByCpfDedupKey(cpfDedupKey);
    if (!credential) {
      throw new NotFoundException({
        error: "CREDENTIAL_NOT_FOUND",
        message: "Nenhuma credencial encontrada para o CPF informado.",
      });
    }

    if (credential.issuerId !== command.issuerId) {
      throw new ForbiddenException({
        error: "CREDENTIAL_ISSUER_MISMATCH",
        message: "Credencial pertence a outro issuer.",
      });
    }

    // Idempotência: se já está no estado terminal desejado, retorna no-op 200.
    if (command.status === "approved" && credential.isApproved()) {
      return {
        updated: false,
        credentialId: credential.id.value,
        status: credential.status,
        kycLevel: credential.kycLevel,
      };
    }
    if (command.status === "rejected" && credential.isRejected()) {
      return {
        updated: false,
        credentialId: credential.id.value,
        status: credential.status,
        kycLevel: credential.kycLevel,
      };
    }

    if (!credential.isPending()) {
      throw new ConflictException({
        error: "CREDENTIAL_NOT_PENDING",
        message: `Credencial não está pendente. Status atual: ${credential.status}.`,
      });
    }

    if (command.status === "approved") {
      credential.approve(command.kycLevel);
    } else {
      credential.reject();
    }

    await this.credentialRepository.updateOrThrow(credential);

    this.logger.log(
      `Credencial ${credential.id.value} do issuer ${command.issuerId} -> ${credential.status} ` +
        `(kycLevel=${credential.kycLevel}${command.reason ? `, reason=${command.reason}` : ""})`,
    );

    return {
      updated: true,
      credentialId: credential.id.value,
      status: credential.status,
      kycLevel: credential.kycLevel,
    };
  }
}
