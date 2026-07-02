import { Injectable } from "@nestjs/common";
import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { EnvService } from "@src/infra/env/env.service";
import { resolvePeriod } from "@src/modules/backoffice/shared/period.util";
import { CommissionSummaryQuery } from "@src/modules/backoffice/commissions/application/queries/commission-summary.query";
import { VerificationsBackofficeDao } from "@src/modules/backoffice/verifications/infra/verifications-backoffice.dao";

export interface CommissionSummaryResult {
  total: number;
  currency: "BRL";
  deltaPct: number;
  comparedTo: { label: string; value: number };
  period: { from: string; to: string; label: string };
}

@Injectable()
@QueryHandler(CommissionSummaryQuery)
export class CommissionSummaryHandler implements IQueryHandler<CommissionSummaryQuery, CommissionSummaryResult> {
  public constructor(
    private readonly dao: VerificationsBackofficeDao,
    private readonly envService: EnvService,
  ) {}

  public async execute(query: CommissionSummaryQuery): Promise<CommissionSummaryResult> {
    const period = resolvePeriod({ period: query.period, from: query.from, to: query.to });
    const rate = this.envService.COMMISSION_PER_VERIFICATION_BRL;

    const [current, previous] = await Promise.all([
      this.dao.countByIssuer(query.issuerId, period.from, period.to),
      this.dao.countByIssuer(query.issuerId, period.previousFrom, period.previousTo),
    ]);

    const total = current * rate;
    const previousValue = previous * rate;
    const deltaPct = previousValue === 0 ? 0 : Math.round(((total - previousValue) / previousValue) * 100);

    return {
      total: round2(total),
      currency: "BRL",
      deltaPct,
      comparedTo: { label: "vs. periodo anterior", value: round2(previousValue) },
      period: {
        from: period.from.toISOString(),
        to: period.to.toISOString(),
        label: period.label,
      },
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
