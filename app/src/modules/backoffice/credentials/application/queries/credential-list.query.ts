import { CredentialStatus } from "@src/infra/database/@prisma/generated/client";

export class CredentialListQuery {
  public constructor(
    public readonly status: CredentialStatus | undefined,
    public readonly limit: number,
    public readonly cursor: string | undefined,
  ) {}
}
