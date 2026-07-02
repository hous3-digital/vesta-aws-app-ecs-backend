import { PeriodKey } from "@src/modules/backoffice/shared/period.util";

export class CommissionKpisQuery {
  public constructor(
    public readonly issuerId: string,
    public readonly period: PeriodKey | undefined,
    public readonly from: string | undefined,
    public readonly to: string | undefined,
  ) {}
}
