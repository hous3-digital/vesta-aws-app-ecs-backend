import { PeriodKey } from "@src/modules/backoffice/shared/period.util";

export class VerificationExportQuery {
  public constructor(
    public readonly period: PeriodKey | undefined,
    public readonly from: string | undefined,
    public readonly to: string | undefined,
  ) {}
}
