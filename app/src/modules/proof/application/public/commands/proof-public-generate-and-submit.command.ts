import type { VestaVC } from "@src/shared/types/vesta-vc.types";

export class ProofPublicGenerateAndSubmitCommand {
  public constructor(
    public readonly vc: VestaVC,
    public readonly privateInputs: { cpf: string; birthDate: string; fullName: string },
    public readonly verifierId: string,
    public readonly minKycLevel: number,
    public readonly challenge: string,
  ) {}
}
