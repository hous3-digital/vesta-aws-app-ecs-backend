import { VerifierStatus } from "@src/modules/backoffice/verifiers/domain/verifier.entity";

export class VerifierUpdateStatusCommand {
  public constructor(public readonly id: string, public readonly status: VerifierStatus) {}
}
