/**
 * Child process that generates a Groth16 proof, forked by ZkService so the
 * CPU-bound snarkjs call does not block the event loop.
 *
 * IPC (process.on / process.send) instead of worker_threads: snarkjs uses a
 * web worker internally and nested worker_threads fail with "Worker is not a
 * constructor". The @src aliases resolve here as anywhere else: nest build
 * rewrites them in dist/, and the ts fork registers tsconfig-paths.
 */

import { createHash } from "crypto";
import { encodeFr, encodeProof } from "@src/modules/zk/infra/zk-encoder";
import type { Groth16Proof } from "@src/shared/types/vesta-vc.types";

interface ZkWorkerInput {
  circuitInput: Record<string, string>;
  wasmPath: string;
  zkeyPath: string;
}

process.on("message", async (msg: ZkWorkerInput) => {
  const { circuitInput, wasmPath, zkeyPath } = msg;

  try {
    const snarkjs = await import("snarkjs");

    const { proof, publicSignals } = (await (snarkjs as any).groth16.fullProve(circuitInput, wasmPath, zkeyPath)) as {
      proof: Groth16Proof;
      publicSignals: string[];
    };

    const encodedProof = encodeProof(proof);
    const encodedPublicSignals = publicSignals.map((s) => encodeFr(s));
    const proofHash = createHash("sha256").update(JSON.stringify(proof)).digest("hex");

    process.send!({ proof, publicSignals, encodedProof, encodedPublicSignals, proofHash });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "ZK worker error desconhecido";
    process.send!({ error: message });
  } finally {
    process.exit(0);
  }
});
