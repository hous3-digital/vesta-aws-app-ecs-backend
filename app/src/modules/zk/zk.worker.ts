/**
 * zk.worker.ts — Processo filho para geração de prova Groth16.
 *
 * Executado via child_process.fork() pelo ZkService para evitar bloquear
 * o event loop do Node.js durante a chamada CPU-bound do snarkjs.
 *
 * Usa IPC (process.on / process.send) em vez de worker_threads porque
 * snarkjs usa web-worker internamente — worker_threads aninhados falham
 * com "Worker is not a constructor" nesse contexto.
 *
 * NOTA: este arquivo usa imports relativos intencionalmente — é spawned
 * como processo filho separado sem acesso ao tsconfig-paths do processo pai.
 */

import { createHash } from "crypto";
// eslint-disable-next-line no-restricted-imports
import { encodeProof, encodeFr } from "./zk-encoder";
// eslint-disable-next-line no-restricted-imports
import type { Groth16Proof } from "../../shared/types/vesta-vc.types";

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
