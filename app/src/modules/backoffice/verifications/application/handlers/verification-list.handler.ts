import { Injectable } from "@nestjs/common";
import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { EnvService } from "@src/infra/env/env.service";
import { VerificationListQuery } from "@src/modules/backoffice/verifications/application/queries/verification-list.query";
import {
  VerificationRecord,
  VerificationsBackofficeDao,
} from "@src/modules/backoffice/verifications/infra/verifications-backoffice.dao";
import { IVerifierRepository } from "@src/modules/backoffice/verifiers/domain/verifier.repository";
import { BackofficeContextService } from "@src/modules/backoffice/shared/backoffice-context.service";
import {
  clampLimit,
  decodeCursor,
  encodeCursor,
} from "@src/modules/backoffice/shared/cursor-pagination.util";

export interface VerificationListItem {
  id: string;
  date: string;
  origin: string;
  verifierId: string;
  verificationHash: string;
  status: "completed" | "failed";
  txHash: string | null;
  ledger: number | null;
  amount: number;
}

export interface VerificationListResult {
  items: VerificationListItem[];
  nextCursor: string | null;
}

@Injectable()
@QueryHandler(VerificationListQuery)
export class VerificationListHandler implements IQueryHandler<VerificationListQuery, VerificationListResult> {
  public constructor(
    private readonly dao: VerificationsBackofficeDao,
    private readonly verifierRepository: IVerifierRepository,
    private readonly context: BackofficeContextService,
    private readonly envService: EnvService,
  ) {}

  public async execute(query: VerificationListQuery): Promise<VerificationListResult> {
    const issuerId = this.context.getCurrentIssuerId();
    const limit = clampLimit(query.limit);
    const cursor = decodeCursor(query.cursor);

    const records = await this.dao.list({
      issuerId,
      verifierId: query.verifierId,
      status: query.status,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      limit,
      cursorTs: cursor?.ts,
      cursorId: cursor?.id,
    });

    const hasMore = records.length > limit;
    const page = hasMore ? records.slice(0, limit) : records;

    const verifierMap = await this.verifierRepository.findManyByIds(page.map((r) => r.verifierId));
    const ratePerVerification = this.envService.COMMISSION_PER_VERIFICATION_BRL;

    const nextCursor = hasMore
      ? encodeCursor({ ts: page[page.length - 1].createdAt.toISOString(), id: page[page.length - 1].id })
      : null;

    return {
      items: page.map((r) => this.toItem(r, verifierMap, ratePerVerification)),
      nextCursor,
    };
  }

  private toItem(
    record: VerificationRecord,
    verifierMap: Map<string, { name: string }>,
    ratePerVerification: number,
  ): VerificationListItem {
    const verifier = verifierMap.get(record.verifierId);
    return {
      id: record.id,
      date: record.createdAt.toISOString(),
      origin: verifier?.name ?? record.verifierId,
      verifierId: record.verifierId,
      verificationHash: record.proofHash,
      status: record.onChainResult ? "completed" : "failed",
      txHash: record.sorobanTxHash,
      ledger: record.sorobanLedger,
      amount: record.onChainResult ? ratePerVerification : 0,
    };
  }
}
