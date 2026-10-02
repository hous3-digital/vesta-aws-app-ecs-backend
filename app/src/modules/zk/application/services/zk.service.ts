import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { EnvService } from "@src/infra/env/env.service";
import type {
  EncodedVerificationKey,
  Groth16Proof,
  ZkProofInput,
  ZkProofResult,
} from "@src/shared/types/vesta-vc.types";
import { encodeProof, encodeFr, encodeVerificationKey } from "@src/modules/zk/infra/zk-encoder";
import { InvalidStateError } from "@src/shared/errors";
import { createHash } from "crypto";
import { fork } from "child_process";
import * as fs from "fs";
import * as path from "path";

/** The Poseidon hashes of the credential a proof must be bound to, as the VC stores them. */
export interface ProofBinding {
  cpfHash: string;
  birthDateHash: string;
  fullNameHash: string;
}

/**
 * Position of each public signal as snarkjs emits them for `vesta_kyc`: the output `kyc_ok` first,
 * then the public inputs in declaration order (`decisions.md`, 2026-09-28; confirmed on 2026-10-02).
 */
const PUBLIC_SIGNAL = { kycOk: 0, cpfHash: 1, birthDateHash: 2, fullNameHash: 3, minKycLevel: 4 } as const;
const PUBLIC_SIGNAL_COUNT = 5;

const ZKEY_FILE = "vesta_kyc_final.zkey";
const WASM_FILE = path.join("vesta_kyc_js", "vesta_kyc.wasm");
const VERIFICATION_KEY_FILE = "verification_key.json";

@Injectable()
export class ZkService implements OnModuleInit {
  private readonly logger = new Logger(ZkService.name);
  private readonly artifactsDir: string;
  private readonly mockMode: boolean;
  private rawVerificationKey: Record<string, unknown> | null = null;
  private encodedVerificationKey: EncodedVerificationKey | null = null;

  public constructor(private readonly envService: EnvService) {
    this.artifactsDir = path.resolve(envService.ZK_ARTIFACTS_DIR);
    this.mockMode = envService.ZK_MOCK_MODE;
    this.logger.log(`Configurado — artifactsDir=${this.artifactsDir}, mockMode=${this.mockMode}`);
  }

  public onModuleInit(): void {
    if (this.mockMode) {
      this.logger.warn("ZK_MOCK_MODE=true: proofs are mocked and never valid for on-chain verification");
      return;
    }

    const expected = [ZKEY_FILE, WASM_FILE, VERIFICATION_KEY_FILE].map((file) => path.join(this.artifactsDir, file));
    const missing = expected.filter((file) => !fs.existsSync(file));
    if (missing.length > 0) {
      throw new Error(
        `ZK artifacts missing in ${this.artifactsDir} with ZK_MOCK_MODE=false (expected ${expected.join(", ")}). ` +
          "Ship the artifacts with the image or set ZK_MOCK_MODE=true explicitly.",
      );
    }

    this.readVerificationKey();
    this.logger.log(`ZK artifacts found in ${this.artifactsDir}: real mode enabled`);
  }

  public isMockMode(): boolean {
    return this.mockMode;
  }

  public getArtifactsDir(): string {
    return this.artifactsDir;
  }

  public async generateProof(input: ZkProofInput): Promise<ZkProofResult> {
    this.logger.log(
      `Gerando prova ZK (${this.mockMode ? "mock" : "real"}) — kycLevel=${input.kycLevel}, minKycLevel=${input.minKycLevel}`,
    );

    if (this.mockMode) {
      return this.buildMockProof(input);
    }

    return this.buildRealProof(input);
  }

  /**
   * The verification key encoded for the Soroban verifier. Real mode caches the file read at boot;
   * mock mode hands the zero key, since mock proofs are never valid on chain anyway.
   */
  public loadVerificationKey(): EncodedVerificationKey {
    if (this.mockMode) {
      const zeroG1 = Buffer.alloc(64);
      const zeroG2 = Buffer.alloc(128);
      return { alpha: zeroG1, beta: zeroG2, gamma: zeroG2, delta: zeroG2, ic: [zeroG1, zeroG1] };
    }
    this.encodedVerificationKey ??= encodeVerificationKey(this.readVerificationKey());
    return this.encodedVerificationKey;
  }

  /**
   * Verifies a Groth16 proof against the circuit verification key and binds its public signals to the
   * credential: `kyc_ok` must be claimed and the three hashes must be the ones the VC stores. The
   * signals are compared before the pairing check because they come from the caller. Mock mode resolves
   * without checking: the mock prover emits two signals and no caller branches on `isMockMode`.
   */
  public async verifyProof(proof: Groth16Proof, publicSignals: string[], binding: ProofBinding): Promise<void> {
    if (this.mockMode) return;

    const mismatched = this.mismatchedSignals(publicSignals, binding);
    if (mismatched.length > 0) {
      throw new InvalidStateError("PROOF_PUBLIC_SIGNALS_MISMATCH", "Public signals do not match the credential", {
        mismatched,
      });
    }

    const snarkjs = await import("snarkjs");
    const valid = await snarkjs.groth16.verify(this.readVerificationKey(), publicSignals, proof);
    if (!valid) {
      throw new InvalidStateError("PROOF_INVALID", "Groth16 proof does not verify against the circuit");
    }
  }

  /** Encodes a proof produced outside this service (the legacy submit route) the way `generateProof` encodes its own. */
  public encodeSubmittedProof(
    proof: Groth16Proof,
    publicSignals: string[],
  ): Pick<ZkProofResult, "encodedProof" | "encodedPublicSignals"> {
    return { encodedProof: encodeProof(proof), encodedPublicSignals: publicSignals.map((signal) => encodeFr(signal)) };
  }

  private mismatchedSignals(publicSignals: string[], binding: ProofBinding): string[] {
    if (publicSignals.length !== PUBLIC_SIGNAL_COUNT) return ["count"];
    const expected: Array<[string, number, string]> = [
      ["kyc_ok", PUBLIC_SIGNAL.kycOk, "1"],
      ["cpf_hash", PUBLIC_SIGNAL.cpfHash, binding.cpfHash],
      ["birth_date_hash", PUBLIC_SIGNAL.birthDateHash, binding.birthDateHash],
      ["full_name_hash", PUBLIC_SIGNAL.fullNameHash, binding.fullNameHash],
    ];
    return expected.filter(([, index, value]) => publicSignals[index] !== value).map(([name]) => name);
  }

  private readVerificationKey(): Record<string, unknown> {
    if (this.rawVerificationKey) return this.rawVerificationKey;
    const vkPath = path.join(this.artifactsDir, VERIFICATION_KEY_FILE);
    try {
      this.rawVerificationKey = JSON.parse(fs.readFileSync(vkPath, "utf-8")) as Record<string, unknown>;
    } catch (cause) {
      throw new Error(`Cannot read the ZK verification key at ${vkPath}: ${(cause as Error).message}`, { cause });
    }
    return this.rawVerificationKey;
  }

  private buildRealProof(input: ZkProofInput): Promise<ZkProofResult> {
    return new Promise<ZkProofResult>((resolve, reject) => {
      const wasmPath = path.join(this.artifactsDir, WASM_FILE);
      const zkeyPath = path.join(this.artifactsDir, ZKEY_FILE);

      const normalized = input.fullName.toUpperCase().trim().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
      const fullNameHex = Buffer.from(normalized).toString("hex").slice(0, 60);
      const fullNameBigInt = String(BigInt("0x" + fullNameHex));

      const circuitInput = {
        cpf: input.cpf,
        birth_date: input.birthDate,
        full_name: fullNameBigInt,
        kyc_level: input.kycLevel.toString(),
        cpf_hash: input.cpfHash,
        birth_date_hash: input.birthDateHash,
        full_name_hash: input.fullNameHash,
        min_kyc_level: input.minKycLevel.toString(),
      };

      const ext = path.extname(__filename);
      const workerFile = path.join(__dirname, "..", "..", "infra", `zk.worker${ext}`);
      const execArgv = ext === ".ts" ? ["-r", "ts-node/register/transpile-only", "-r", "tsconfig-paths/register"] : [];

      this.logger.log(`Gerando prova Groth16 via child process — arquivo: zk.worker${ext}`);

      const child = fork(workerFile, [], { execArgv, silent: false });

      child.send({ circuitInput, wasmPath, zkeyPath });

      child.once("message", (result: ZkProofResult & { error?: string }) => {
        if (result.error) {
          reject(new Error(`ZK Worker: ${result.error}`));
        } else {
          this.logger.log("Prova Groth16 gerada pelo child process");
          resolve(result);
        }
        child.kill();
      });

      child.once("error", (err) => {
        reject(new Error(`ZK Worker falhou: ${err.message}`));
      });

      child.once("exit", (code) => {
        if (code !== 0 && code !== null) {
          reject(new Error(`ZK Worker encerrou com código ${code}`));
        }
      });
    });
  }

  private buildMockProof(input: ZkProofInput): ZkProofResult {
    this.logger.warn("Retornando prova ZK MOCK — não válida para verificação real");

    const mockProof: Groth16Proof = {
      pi_a: [
        "18179065977147657779359641627266856730189560012430348972168729148195594119398",
        "4325130652974965851962487796548080753812713465953132240508427612753615137668",
        "1",
      ],
      pi_b: [
        [
          "18395390851775000847122561780630950260849796100997778613417368640548299239475",
          "17639909396142653244025863699056463248483166788147768144883360518935838049735",
        ],
        [
          "9408131275963864266616099995774753746213060751552818483760857814043622474916",
          "8981404227605788652195858905745591103367179864186050631891035451705025332378",
        ],
        ["1", "0"],
      ],
      pi_c: [
        "1737020500140345915930097080595151095303222939533212987558942021306795966145",
        "145473143193388753772867796175071880043993095936447841945077555539388439000",
        "1",
      ],
      protocol: "groth16",
      curve: "bn128",
    };

    const publicSignals = [input.minKycLevel.toString(), "1"];

    const encoded = encodeProof(mockProof);
    const encodedPublicSignals = publicSignals.map((s) => encodeFr(s));
    const proofHash = createHash("sha256")
      .update(JSON.stringify({ mock: true, kycLevel: input.kycLevel, input }))
      .digest("hex");

    return { proof: mockProof, publicSignals, encodedProof: encoded, encodedPublicSignals, proofHash };
  }
}
