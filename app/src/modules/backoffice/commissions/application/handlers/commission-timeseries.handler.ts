import { Injectable } from "@nestjs/common";
import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { resolvePeriod } from "@src/modules/backoffice/shared/period.util";
import { CommissionTimeseriesQuery } from "@src/modules/backoffice/commissions/application/queries/commission-timeseries.query";
import { CommissionLedgerService } from "@src/modules/commission/commission-ledger.service";

export interface CommissionSeriesPoint {
  date: string;
  reutilizacoes: number;
  comissao: number;
}

export interface CommissionTimeseriesResult {
  series: CommissionSeriesPoint[];
  period: { from: string; to: string; label: string };
}

@Injectable()
@QueryHandler(CommissionTimeseriesQuery)
export class CommissionTimeseriesHandler
  implements IQueryHandler<CommissionTimeseriesQuery, CommissionTimeseriesResult>
{
  public constructor(private readonly ledger: CommissionLedgerService) {}

  public async execute(query: CommissionTimeseriesQuery): Promise<CommissionTimeseriesResult> {
    const period = resolvePeriod({ period: query.period, from: query.from, to: query.to });
    const totals = await this.ledger.periodTotals(query.issuerId, period.from, period.to);
    const grouped = new Map<string, { count: number; amountMinor: number }>();
    for (const row of totals.rows) {
      const date = row.occurredAt.toISOString().slice(0, 10);
      const current = grouped.get(date) ?? { count: 0, amountMinor: 0 };
      grouped.set(date, {
        count: current.count + (row.entryType === "ACCRUAL" ? 1 : 0),
        amountMinor: current.amountMinor + row.amountMinor,
      });
    }
    const daily = [...grouped].map(([date, value]) => ({ date, ...value }));
    const series = fillMissingDays(daily, period.from, period.to).map((point) => ({
      date: point.date,
      reutilizacoes: point.count,
      comissao: point.amountMinor / 100,
    }));

    return {
      series,
      period: { from: period.from.toISOString(), to: period.to.toISOString(), label: period.label },
    };
  }
}

function fillMissingDays(
  daily: Array<{ date: string; count: number; amountMinor: number }>,
  from: Date,
  to: Date,
): Array<{ date: string; count: number; amountMinor: number }> {
  const map = new Map(daily.map((d) => [d.date, d]));
  const result: Array<{ date: string; count: number; amountMinor: number }> = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));

  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    result.push(map.get(key) ?? { date: key, count: 0, amountMinor: 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return result;
}
