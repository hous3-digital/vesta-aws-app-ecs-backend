import { Injectable } from "@nestjs/common";
import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { EnvService } from "@src/infra/env/env.service";
import { resolvePeriod } from "@src/modules/backoffice/shared/period.util";
import { CommissionTimeseriesQuery } from "@src/modules/backoffice/commissions/application/queries/commission-timeseries.query";
import { VerificationsBackofficeDao } from "@src/modules/backoffice/verifications/infra/verifications-backoffice.dao";

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
  public constructor(
    private readonly dao: VerificationsBackofficeDao,
    private readonly envService: EnvService,
  ) {}

  public async execute(query: CommissionTimeseriesQuery): Promise<CommissionTimeseriesResult> {
    const period = resolvePeriod({ period: query.period, from: query.from, to: query.to });
    const rate = this.envService.COMMISSION_PER_VERIFICATION_BRL;

    const daily = await this.dao.dailyCount(query.issuerId, period.from, period.to);
    const series = fillMissingDays(daily, period.from, period.to).map((point) => ({
      date: point.date,
      reutilizacoes: point.count,
      comissao: Math.round(point.count * rate * 100) / 100,
    }));

    return {
      series,
      period: { from: period.from.toISOString(), to: period.to.toISOString(), label: period.label },
    };
  }
}

function fillMissingDays(
  daily: Array<{ date: string; count: number }>,
  from: Date,
  to: Date,
): Array<{ date: string; count: number }> {
  const map = new Map(daily.map((d) => [d.date, d.count]));
  const result: Array<{ date: string; count: number }> = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));

  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    result.push({ date: key, count: map.get(key) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return result;
}
