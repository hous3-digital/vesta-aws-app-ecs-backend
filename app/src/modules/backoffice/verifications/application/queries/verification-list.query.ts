export class VerificationListQuery {
  public constructor(
    public readonly verifierId: string | undefined,
    public readonly status: "completed" | "failed" | undefined,
    public readonly from: string | undefined,
    public readonly to: string | undefined,
    public readonly limit: number,
    public readonly cursor: string | undefined,
  ) {}
}
