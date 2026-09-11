import { BadRequestException, ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { ChallengeService } from "@src/modules/challenge/challenge.service";
import { ICredentialRepository } from "@src/modules/credential/domain/credential.repository";
import { VcService } from "@src/modules/vc/vc.service";
import type { VestaVC } from "@src/shared/types/vesta-vc.types";

export interface CredentialRecoveryResult {
  vc: VestaVC;
  vcHash: string;
}

@Injectable()
export class CredentialRecoveryService {
  public constructor(
    private readonly challengeService: ChallengeService,
    private readonly credentialRepository: ICredentialRepository,
    private readonly vcService: VcService,
  ) {}

  public async recover(issuerId: string, recoveryToken: string): Promise<CredentialRecoveryResult> {
    const context = await this.challengeService.consumeContext(recoveryToken);
    if (!context || context.kind !== "credential-recovery") {
      throw new BadRequestException("Token de recuperação inválido, expirado ou já utilizado");
    }
    if (context.issuerId !== issuerId) {
      throw new ForbiddenException("Token de recuperação não pertence ao issuer autenticado");
    }

    const credential = await this.credentialRepository.findByVcHash(context.vcHash);
    if (
      !credential ||
      credential.issuerId !== issuerId ||
      !credential.isApproved() ||
      credential.isExpired() ||
      credential.isRevoked()
    ) {
      throw new ForbiddenException("Credencial indisponível para recuperação");
    }
    if (!credential.vcDocument) {
      throw new ConflictException({
        error: "VC_RECOVERY_NOT_AVAILABLE",
        message: "Esta credencial foi emitida antes do suporte à recuperação e exige revalidação.",
      });
    }
    if (this.vcService.hashVC(credential.vcDocument) !== credential.vcHash) {
      throw new ConflictException("Documento da credencial falhou na verificação de integridade");
    }

    return { vc: credential.vcDocument, vcHash: credential.vcHash };
  }
}
