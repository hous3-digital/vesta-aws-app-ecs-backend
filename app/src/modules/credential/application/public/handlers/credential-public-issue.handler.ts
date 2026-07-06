import { createHmac } from "crypto";
import { ConflictException, Injectable, Logger, UnprocessableEntityException } from "@nestjs/common";
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { CredentialPublicIssueCommand } from "@src/modules/credential/application/public/commands/credential-public-issue.command";
import { Credential } from "@src/modules/credential/domain/credential.entity";
import { ICredentialRepository } from "@src/modules/credential/domain/credential.repository";
import { EnvService } from "@src/infra/env/env.service";
import { VcService } from "@src/modules/vc/vc.service";
import { WalletService } from "@src/modules/wallet/wallet.service";
import { IIssuerRepository } from "@src/modules/issuer/domain/issuer.repository";
import type { VestaVC } from "@src/shared/types/vesta-vc.types";

export interface CredentialIssueResult {
  vc: VestaVC;
  vcHash: string;
  credentialId: string;
  status: string;
  expiresAt: string;
  alreadyExisted: boolean;
  userWalletAddress: string | null;
}

@Injectable()
@CommandHandler(CredentialPublicIssueCommand)
export class CredentialPublicIssueHandler implements ICommandHandler<CredentialPublicIssueCommand, CredentialIssueResult> {
  private readonly logger = new Logger(CredentialPublicIssueHandler.name);

  public constructor(
    private readonly credentialRepository: ICredentialRepository,
    private readonly vcService: VcService,
    private readonly envService: EnvService,
    private readonly walletService: WalletService,
    private readonly issuerRepository: IIssuerRepository,
  ) {}

  public async execute(command: CredentialPublicIssueCommand): Promise<CredentialIssueResult> {
    const issuer = await this.issuerRepository.findByExternalId(command.issuerId);
    if (!issuer) {
      throw new UnprocessableEntityException({
        error: "ISSUER_NOT_REGISTERED",
        message: `Issuer '${command.issuerId}' nao esta cadastrado`,
      });
    }
    if (!issuer.isActive()) {
      throw new UnprocessableEntityException({
        error: "ISSUER_INACTIVE",
        message: `Issuer '${command.issuerId}' esta inativo`,
      });
    }

    const { vc, vcHash } = await this.vcService.generateVC({
      cpf: command.cpf,
      fullName: command.fullName,
      birthDate: command.birthDate,
      kycLevel: command.kycLevel,
      kycMethod: command.kycMethod,
      issuerId: command.issuerId,
      issuerName: issuer.name,
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

    // Eager Privy wallet pre-creation. Per design (Issuer.privyEnabled gate),
    // only issuers flagged for Privy get wallets at issuance time. A failure
    // here MUST NOT block the credential emission — the wallet can be created
    // lazily on the first /public/proof/prepare call instead.
    if (await this.walletService.isEnabledForIssuer(command.issuerId)) {
      try {
        const wallet = await this.walletService.precreateForCredential({
          subjectDid: credential.subjectDid,
          cpfDedupKey: credential.cpfDedupKey,
        });
        credential.attachWallet({
          userWalletAddress: wallet.stellarAddress,
          privyUserId: wallet.privyUserId,
        });
        await this.credentialRepository.updateOrThrow(credential);
      } catch (err) {
        this.logger.error(
          `Falha ao pré-criar wallet Privy para credencial ${credential.id.value}: ${(err as Error).message}. ` +
            "Wallet será criada lazy no primeiro /public/proof/prepare.",
        );
      }
    }

    return {
      vc,
      vcHash,
      credentialId: credential.id.value,
      status: credential.status,
      expiresAt: vc.expiration_date,
      alreadyExisted: false,
      userWalletAddress: credential.userWalletAddress,
    };
  }
}
