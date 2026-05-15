import { Injectable } from "@nestjs/common";
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { CredentialPublicIssueCommand } from "@src/modules/credential/application/public/commands/credential-public-issue.command";
import { Credential } from "@src/modules/credential/domain/credential.entity";
import { ICredentialRepository } from "@src/modules/credential/domain/credential.repository";
import { VcService } from "@src/modules/vc/vc.service";
import type { VestaVC } from "@src/shared/types/vesta-vc.types";

export interface CredentialIssueResult {
  vc: VestaVC;
  vcHash: string;
  credentialId: string;
  status: string;
  expiresAt: string;
  alreadyExisted: boolean;
}

@Injectable()
@CommandHandler(CredentialPublicIssueCommand)
export class CredentialPublicIssueHandler implements ICommandHandler<CredentialPublicIssueCommand, CredentialIssueResult> {
  public constructor(
    private readonly credentialRepository: ICredentialRepository,
    private readonly vcService: VcService,
  ) {}

  public async execute(command: CredentialPublicIssueCommand): Promise<CredentialIssueResult> {
    const { vc, vcHash } = await this.vcService.generateVC({
      cpf: command.cpf,
      fullName: command.fullName,
      birthDate: command.birthDate,
      kycLevel: command.kycLevel,
      kycMethod: command.kycMethod,
      issuerId: command.issuerId,
      issuerName: `${command.issuerId} S.A.`,
      nationality: command.nationality,
      expirationDays: command.expirationDays,
    });

    const existing = await this.credentialRepository.findByVcHash(vcHash);
    if (existing) {
      return {
        vc,
        vcHash,
        credentialId: existing.id.value,
        status: existing.status,
        expiresAt: existing.expiresAt.toISOString(),
        alreadyExisted: true,
      };
    }

    const credential = Credential.issue({
      vcHash,
      issuerDid: vc.issuer.id,
      issuerId: command.issuerId,
      subjectDid: vc.credential_subject.id,
      kycLevel: command.kycLevel,
      expiresAt: new Date(vc.expiration_date),
    });

    await this.credentialRepository.saveOrThrow(credential);

    return {
      vc,
      vcHash,
      credentialId: credential.id.value,
      status: credential.status,
      expiresAt: vc.expiration_date,
      alreadyExisted: false,
    };
  }
}
