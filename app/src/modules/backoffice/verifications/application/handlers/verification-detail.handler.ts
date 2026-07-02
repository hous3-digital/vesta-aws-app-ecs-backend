import { Injectable, NotFoundException } from "@nestjs/common";
import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { EnvService } from "@src/infra/env/env.service";
import { VerificationDetailQuery } from "@src/modules/backoffice/verifications/application/queries/verification-detail.query";
import { VerificationsBackofficeDao } from "@src/modules/backoffice/verifications/infra/verifications-backoffice.dao";
import { IVerifierRepository } from "@src/modules/backoffice/verifiers/domain/verifier.repository";

export interface VerificationDetailResult {
  id: string;
  date: string;
  origin: string;
  verifierId: string;
  vcHash: string;
  verificationHash: string;
  kycLevel: string;
  status: "completed" | "failed";
  txHash: string | null;
  ledger: number | null;
  amount: number;
}

@Injectable()
@QueryHandler(VerificationDetailQuery)
export class VerificationDetailHandler
  implements IQueryHandler<VerificationDetailQuery, VerificationDetailResult>
{
  public constructor(
    private readonly dao: VerificationsBackofficeDao,
    private readonly verifierRepository: IVerifierRepository,
    private readonly envService: EnvService,
  ) {}

  public async execute(query: VerificationDetailQuery): Promise<VerificationDetailResult> {
    const record = await this.dao.findById(query.issuerId, query.id);
    if (!record) throw new NotFoundException(`Verificacao nao encontrada: ${query.id}`);

    const verifier = await this.verifierRepository.findById(record.verifierId);
    const ratePerVerification = this.envService.COMMISSION_PER_VERIFICATION_BRL;

    return {
      id: record.id,
      date: record.createdAt.toISOString(),
      origin: verifier?.name ?? record.verifierId,
      verifierId: record.verifierId,
      vcHash: record.vcHash,
      verificationHash: record.proofHash,
      kycLevel: record.kycLevel,
      status: record.onChainResult ? "completed" : "failed",
      txHash: record.sorobanTxHash,
      ledger: record.sorobanLedger,
      amount: record.onChainResult ? ratePerVerification : 0,
    };
  }
}
