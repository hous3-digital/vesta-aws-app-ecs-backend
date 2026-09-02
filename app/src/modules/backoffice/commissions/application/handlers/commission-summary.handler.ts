import { Injectable } from "@nestjs/common";
import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { resolvePeriod } from "@src/modules/backoffice/shared/period.util";
import { CommissionSummaryQuery } from "@src/modules/backoffice/commissions/application/queries/commission-summary.query";
import { CommissionLedgerService } from "@src/modules/commission/commission-ledger.service";

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
  public constructor(private readonly ledger: CommissionLedgerService) {}

  public async execute(query: CommissionSummaryQuery): Promise<CommissionSummaryResult> {
    const period = resolvePeriod({ period: query.period, from: query.from, to: query.to });
    const [current, previous] = await Promise.all([
      this.ledger.periodTotals(query.issuerId, period.from, period.to),
      this.ledger.periodTotals(query.issuerId, period.previousFrom, period.previousTo),
    ]);

    const total = current.amountMinor / 100;
    const previousValue = previous.amountMinor / 100;
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
