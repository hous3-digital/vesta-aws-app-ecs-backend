import { Injectable } from "@nestjs/common";
import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { CommissionBalanceQuery } from "@src/modules/backoffice/commissions/application/queries/commission-balance.query";
import { CommissionLedgerService } from "@src/modules/commission/commission-ledger.service";

export interface CommissionBalanceResult {
  amount: number;
  currency: "BRL";
  verificationsCount: number;
  pendingSecurity: { amount: number; entriesCount: number };
  available: { amount: number; entriesCount: number };
  allocated: { amount: number; entriesCount: number };
  settled: { amount: number; entriesCount: number };
}

@Injectable()
@QueryHandler(CommissionBalanceQuery)
export class CommissionBalanceHandler implements IQueryHandler<CommissionBalanceQuery, CommissionBalanceResult> {
  public constructor(private readonly ledger: CommissionLedgerService) {}

  public async execute(query: CommissionBalanceQuery): Promise<CommissionBalanceResult> {
    return this.ledger.getBalance(query.issuerId);
  }
}
