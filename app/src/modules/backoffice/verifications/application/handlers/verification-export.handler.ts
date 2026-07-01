import { Injectable } from "@nestjs/common";
import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { EnvService } from "@src/infra/env/env.service";
import { resolvePeriod } from "@src/modules/backoffice/shared/period.util";
import { BackofficeContextService } from "@src/modules/backoffice/shared/backoffice-context.service";
import { VerificationExportQuery } from "@src/modules/backoffice/verifications/application/queries/verification-export.query";
import { VerificationsBackofficeDao } from "@src/modules/backoffice/verifications/infra/verifications-backoffice.dao";
import { IVerifierRepository } from "@src/modules/backoffice/verifiers/domain/verifier.repository";

export interface VerificationExportResult {
  filename: string;
  csv: string;
}

const HEADER = ["id", "date", "verifierId", "verifierName", "vcHash", "verificationHash", "status", "txHash", "ledger", "amountBRL"].join(",");

@Injectable()
@QueryHandler(VerificationExportQuery)
export class VerificationExportHandler implements IQueryHandler<VerificationExportQuery, VerificationExportResult> {
  public constructor(
    private readonly dao: VerificationsBackofficeDao,
    private readonly verifierRepository: IVerifierRepository,
    private readonly context: BackofficeContextService,
    private readonly envService: EnvService,
  ) {}

  public async execute(query: VerificationExportQuery): Promise<VerificationExportResult> {
    const issuerId = this.context.getCurrentIssuerId();
    const period = resolvePeriod({ period: query.period, from: query.from, to: query.to });

    const records = await this.dao.list({
      issuerId,
      from: period.from,
      to: period.to,
      limit: 100000,
    });

    const verifierMap = await this.verifierRepository.findManyByIds(records.map((r) => r.verifierId));
    const rate = this.envService.COMMISSION_PER_VERIFICATION_BRL;

    const rows = records.map((r) => {
      const verifier = verifierMap.get(r.verifierId);
      const cells = [
        r.id,
        r.createdAt.toISOString(),
        r.verifierId,
        verifier?.name ?? "",
        r.vcHash,
        r.proofHash,
        r.onChainResult ? "completed" : "failed",
        r.sorobanTxHash ?? "",
        r.sorobanLedger?.toString() ?? "",
        r.onChainResult ? rate.toFixed(4) : "0.0000",
      ];
      return cells.map(escapeCsv).join(",");
    });

    const csv = [HEADER, ...rows].join("\n");
    const filename = `verifications-${period.label.replace(/\s+/g, "_")}.csv`;

    return { filename, csv };
  }
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
