/**
 * Minimal declarations for libraries that ship no types. They type only the
 * surface this codebase calls; extend them here when a new call is needed.
 */
declare module "snarkjs" {
  export interface Groth16Proof {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
    protocol: string;
    curve: string;
  }

  export interface Groth16FullProveResult {
    proof: Groth16Proof;
    publicSignals: string[];
  }

  export const groth16: {
    fullProve(input: Record<string, unknown>, wasmPath: string, zkeyPath: string): Promise<Groth16FullProveResult>;
    verify(verificationKey: unknown, publicSignals: string[], proof: Groth16Proof): Promise<boolean>;
  };
}

declare module "circomlibjs" {
  export interface PoseidonField {
    toString(value: unknown): string;
    toObject(value: unknown): bigint;
  }

  export interface Poseidon {
    (inputs: bigint[]): unknown;
    F: PoseidonField;
  }

  export function buildPoseidon(): Promise<Poseidon>;
}
