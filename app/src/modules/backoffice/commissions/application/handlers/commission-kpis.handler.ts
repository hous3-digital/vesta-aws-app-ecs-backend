import { Injectable } from "@nestjs/common";
import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { EnvService } from "@src/infra/env/env.service";
import { resolvePeriod } from "@src/modules/backoffice/shared/period.util";
import { CommissionKpisQuery } from "@src/modules/backoffice/commissions/application/queries/commission-kpis.query";
import { CredentialsBackofficeDao } from "@src/modules/backoffice/credentials/infra/credentials-backoffice.dao";
import { VerificationsBackofficeDao } from "@src/modules/backoffice/verifications/infra/verifications-backoffice.dao";

interface KpiValue {
  value: number;
  deltaPct: number;
}

export interface CommissionKpisResult {
  reutilizacoes: KpiValue;
  credenciaisAtivas: KpiValue;
  porReutilizacao: KpiValue;
}

@Injectable()
@QueryHandler(CommissionKpisQuery)
export class CommissionKpisHandler implements IQueryHandler<CommissionKpisQuery, CommissionKpisResult> {
  public constructor(
    private readonly verificationsDao: VerificationsBackofficeDao,
    private readonly credentialsDao: CredentialsBackofficeDao,
    private readonly envService: EnvService,
  ) {}

  public async execute(query: CommissionKpisQuery): Promise<CommissionKpisResult> {
    const period = resolvePeriod({ period: query.period, from: query.from, to: query.to });
    const rate = this.envService.COMMISSION_PER_VERIFICATION_BRL;

    const [reuseNow, reusePrev, activeNow, activePrev] = await Promise.all([
      this.verificationsDao.countByIssuer(query.issuerId, period.from, period.to),
      this.verificationsDao.countByIssuer(query.issuerId, period.previousFrom, period.previousTo),
      this.credentialsDao.countActiveAt(query.issuerId, period.to),
      this.credentialsDao.countActiveAt(query.issuerId, period.previousTo),
    ]);

    return {
      reutilizacoes: { value: reuseNow, deltaPct: pctDelta(reuseNow, reusePrev) },
      credenciaisAtivas: { value: activeNow, deltaPct: pctDelta(activeNow, activePrev) },
      porReutilizacao: { value: round4(rate), deltaPct: 0 },
    };
  }
}

function pctDelta(now: number, prev: number): number {
  if (prev === 0) return now > 0 ? 100 : 0;
  return Math.round(((now - prev) / prev) * 100);
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
