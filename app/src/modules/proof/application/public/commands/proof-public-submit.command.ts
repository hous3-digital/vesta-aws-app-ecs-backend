import type { Groth16Proof } from "@src/shared/types/vesta-vc.types";

export class ProofPublicSubmitCommand {
  public constructor(
    public readonly vcHash: string,
    public readonly proof: Groth16Proof,
    public readonly publicSignals: string[],
    public readonly verifierId: string,
  ) {}
}
