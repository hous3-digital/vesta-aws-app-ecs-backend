import { Injectable } from "@nestjs/common";
import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { CommissionPendingQuery } from "@src/modules/backoffice/commissions/application/queries/commission-pending.query";
import { CommissionLedgerService } from "@src/modules/commission/commission-ledger.service";

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
  public constructor(private readonly ledger: CommissionLedgerService) {}

  public async execute(query: CommissionPendingQuery): Promise<CommissionPendingResult> {
    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

    const totals = await this.ledger.periodTotals(query.issuerId, periodStart, periodEnd);

    return {
      amount: totals.amountMinor / 100,
      currency: "BRL",
      verificationsCount: totals.count,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      note: "Valor registrado no ledger; ficará disponível após o período de segurança.",
    };
  }
}
