import type { Groth16Proof } from "@src/shared/types/vesta-vc.types";
import { FIXTURE_VERIFIER_ID } from "@test/constants";

/** Bodies for /public/proof, built from a credential issued in the same spec. */
export class ProofApiFixture {
  /** privateInputs must match the issued credential exactly; birthDate goes as YYYYMMDD. */
  public static prepare(
    issued: { vc: unknown; cpf: string; fullName: string; birthDate: string },
    challenge: string,
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      vc: issued.vc,
      privateInputs: {
        cpf: issued.cpf,
        birthDate: issued.birthDate.replace(/-/g, ""),
        fullName: issued.fullName,
      },
      verifierId: FIXTURE_VERIFIER_ID,
      minKycLevel: 1,
      challenge,
      ...overrides,
    };
  }

  /** Legacy flow: a proof generated outside the API, submitted against an issued credential. */
  public static submit(
    issued: { vcHash: string },
    proof: Groth16Proof,
    publicSignals: string[],
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return { vcHash: issued.vcHash, proof, publicSignals, verifierId: FIXTURE_VERIFIER_ID, ...overrides };
  }

  public static submitSigned(prepared: { prepareSessionId: string; unsignedTxXdr: string }): Record<string, unknown> {
    return { prepareSessionId: prepared.prepareSessionId, signedTxXdr: prepared.unsignedTxXdr };
  }
}
