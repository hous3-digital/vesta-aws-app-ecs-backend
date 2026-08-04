import { BadRequestException } from "@nestjs/common";

export type PeriodKey = "Q1" | "Q2" | "Q3" | "Q4" | "custom";

export interface ResolvedPeriod {
  from: Date;
  to: Date;
  previousFrom: Date;
  previousTo: Date;
  label: string;
}

const QUARTERS: Record<Exclude<PeriodKey, "custom">, { startMonth: number; endMonth: number }> = {
  Q1: { startMonth: 0, endMonth: 2 },
  Q2: { startMonth: 3, endMonth: 5 },
  Q3: { startMonth: 6, endMonth: 8 },
  Q4: { startMonth: 9, endMonth: 11 },
};

export function resolvePeriod(params: {
  period?: PeriodKey;
  from?: string;
  to?: string;
  referenceDate?: Date;
}): ResolvedPeriod {
  const reference = params.referenceDate ?? new Date();
  const year = reference.getUTCFullYear();

  if (params.period && params.period !== "custom") {
    const quarter = QUARTERS[params.period];
    const from = new Date(Date.UTC(year, quarter.startMonth, 1, 0, 0, 0, 0));
    const to = new Date(Date.UTC(year, quarter.endMonth + 1, 0, 23, 59, 59, 999));
    const previousFrom = new Date(Date.UTC(year, quarter.startMonth - 3, 1, 0, 0, 0, 0));
    const previousTo = new Date(Date.UTC(year, quarter.endMonth - 2, 0, 23, 59, 59, 999));
    return { from, to, previousFrom, previousTo, label: `${params.period} ${year}` };
  }

  if (!params.from || !params.to) {
    throw new BadRequestException(
      "Periodo invalido: informe period=Q1|Q2|Q3|Q4 ou period=custom com from/to (ISO 8601)",
    );
  }

  const from = new Date(params.from);
  const to = new Date(params.to);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new BadRequestException("from/to devem ser datas ISO 8601 validas");
  }

  if (from > to) {
    throw new BadRequestException("from deve ser anterior ou igual a to");
  }

  const rangeMs = to.getTime() - from.getTime();
  const previousTo = new Date(from.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - rangeMs);

  return { from, to, previousFrom, previousTo, label: "custom" };
}
