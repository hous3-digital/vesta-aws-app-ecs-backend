import { createHmac } from "crypto";
import { ConflictException, Injectable } from "@nestjs/common";
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { CredentialPublicIssueCommand } from "@src/modules/credential/application/public/commands/credential-public-issue.command";
import { Credential } from "@src/modules/credential/domain/credential.entity";
import { ICredentialRepository } from "@src/modules/credential/domain/credential.repository";
import { EnvService } from "@src/infra/env/env.service";
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
    private readonly envService: EnvService,
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

    // Compute a server-side HMAC-SHA256 dedup key so we can detect duplicate
    // CPFs without storing the CPF itself. The server secret makes the key
    // brute-force-resistant even if the database is compromised.
    const cpfDedupKey = createHmac("sha256", this.envService.CPF_HMAC_SECRET)
      .update(command.cpf)
      .digest("hex");

    // Block early: CPF already has an active credential on another device.
    // Return a semantic 409 so the client can show a clear message before
    // registering any passkey or running KYC.
    const existingByCpf = await this.credentialRepository.findByCpfDedupKey(cpfDedupKey);
    if (existingByCpf) {
      throw new ConflictException({
        error: "CPF_ALREADY_REGISTERED",
        message: "Este CPF já possui uma credencial ativa. Use o dispositivo onde ela foi criada para autenticar.",
      });
    }

    const credential = Credential.issue({
      vcHash,
      cpfDedupKey,
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
