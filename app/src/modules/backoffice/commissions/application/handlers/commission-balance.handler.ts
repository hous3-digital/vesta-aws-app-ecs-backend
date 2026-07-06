import { Injectable } from "@nestjs/common";
import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { EnvService } from "@src/infra/env/env.service";
import { CommissionBalanceQuery } from "@src/modules/backoffice/commissions/application/queries/commission-balance.query";
import { VerificationsBackofficeDao } from "@src/modules/backoffice/verifications/infra/verifications-backoffice.dao";

export interface CommissionBalanceResult {
  amount: number;
  currency: "BRL";
  verificationsCount: number;
}

@Injectable()
@QueryHandler(CommissionBalanceQuery)
export class CommissionBalanceHandler implements IQueryHandler<CommissionBalanceQuery, CommissionBalanceResult> {
  public constructor(
    private readonly dao: VerificationsBackofficeDao,
    private readonly envService: EnvService,
  ) {}

  public async execute(query: CommissionBalanceQuery): Promise<CommissionBalanceResult> {
    const verificationsCount = await this.dao.countCompletedByIssuer(query.issuerId);
    const amount = Math.round(
      verificationsCount * this.envService.COMMISSION_PER_VERIFICATION_BRL * 100,
    ) / 100;

    return {
      amount,
      currency: "BRL",
      verificationsCount,
    };
  }
}
