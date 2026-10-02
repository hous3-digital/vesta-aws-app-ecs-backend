import type { ZkService } from "@src/modules/zk/application/services/zk.service";
import { encodeFr, encodeProof } from "@src/modules/zk/infra/zk-encoder";
import type { Groth16Proof } from "@src/shared/types/vesta-vc.types";

export type ZkServiceDouble = jest.Mocked<
  Pick<ZkService, "isMockMode" | "loadVerificationKey" | "encodeSubmittedProof" | "verifyProof" | "generateProof">
>;

/**
 * Real mode by default: `verifyProof` resolves (a valid proof) until the spec makes it throw,
 * `encodeSubmittedProof` runs the real pure encoder, and the verification key is the zero key.
 */
export function mockZkService(): ZkServiceDouble {
  return {
    isMockMode: jest.fn().mockReturnValue(false),
    loadVerificationKey: jest.fn().mockReturnValue({
      alpha: Buffer.alloc(64),
      beta: Buffer.alloc(128),
      gamma: Buffer.alloc(128),
      delta: Buffer.alloc(128),
      ic: [Buffer.alloc(64), Buffer.alloc(64)],
    }),
    encodeSubmittedProof: jest.fn((proof: Groth16Proof, publicSignals: string[]) => ({
      encodedProof: encodeProof(proof),
      encodedPublicSignals: publicSignals.map((signal) => encodeFr(signal)),
    })),
    verifyProof: jest.fn().mockResolvedValue(undefined),
    generateProof: jest.fn().mockRejectedValue(new Error("generateProof has no default; set it in the spec")),
  } as unknown as ZkServiceDouble;
}
