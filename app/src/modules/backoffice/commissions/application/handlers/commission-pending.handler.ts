import { Injectable } from "@nestjs/common";
import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { EnvService } from "@src/infra/env/env.service";
import { CommissionPendingQuery } from "@src/modules/backoffice/commissions/application/queries/commission-pending.query";
import { VerificationsBackofficeDao } from "@src/modules/backoffice/verifications/infra/verifications-backoffice.dao";

export interface CommissionPendingResult {
  amount: number;
  currency: "BRL";
  verificationsCount: number;
  periodStart: string;
  periodEnd: string;
  note: string;
}

@Injectable()
@QueryHandler(CommissionPendingQuery)
export class CommissionPendingHandler implements IQueryHandler<CommissionPendingQuery, CommissionPendingResult> {
  public constructor(
    private readonly dao: VerificationsBackofficeDao,
    private readonly envService: EnvService,
  ) {}

  public async execute(query: CommissionPendingQuery): Promise<CommissionPendingResult> {
    const rate = this.envService.COMMISSION_PER_VERIFICATION_BRL;

    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

    const count = await this.dao.countByIssuer(query.issuerId, periodStart, periodEnd);
    const amount = Math.round(count * rate * 100) / 100;

    return {
      amount,
      currency: "BRL",
      verificationsCount: count,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      note: "Calculado em tempo real — sem repasse efetivo nesta fase do produto.",
    };
  }
}
