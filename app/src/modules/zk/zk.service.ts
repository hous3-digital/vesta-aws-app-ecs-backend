import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { EnvService } from "@src/infra/env/env.service";
import type { EncodedVerificationKey, Groth16Proof, ZkProofInput, ZkProofResult } from "@src/shared/types/vesta-vc.types";
import { encodeProof, encodeFr, encodeVerificationKey } from "@src/modules/zk/zk-encoder";
import { createHash } from "crypto";
import { fork } from "child_process";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class ZkService implements OnModuleInit {
  private readonly logger = new Logger(ZkService.name);
  private readonly artifactsDir: string;
  private mockMode: boolean;

  public constructor(private readonly envService: EnvService) {
    this.artifactsDir = path.resolve(envService.ZK_ARTIFACTS_DIR);
    this.mockMode = envService.ZK_MOCK_MODE;
    this.logger.log(`Configurado — artifactsDir=${this.artifactsDir}, mockMode=${this.mockMode}`);
  }

  public onModuleInit(): void {
    const wasmPath = path.join(this.artifactsDir, "vesta_kyc_js", "vesta_kyc.wasm");
    const zkeyPath = path.join(this.artifactsDir, "vesta_kyc_final.zkey");

    this.logger.log(`Verificando artefatos ZK em: ${this.artifactsDir}`);
    this.logger.log(`  wasm: ${wasmPath} — existe=${fs.existsSync(wasmPath)}`);
    this.logger.log(`  zkey: ${zkeyPath} — existe=${fs.existsSync(zkeyPath)}`);

    if (this.mockMode) {
      this.logger.warn("ZK_MOCK_MODE=true — usando prova fake (sem verificação real)");
      return;
    }

    if (!fs.existsSync(wasmPath) || !fs.existsSync(zkeyPath)) {
      this.logger.warn(
        "Artefatos ZK não encontrados. Ativando mock mode automático. " +
          "Execute o build do circuito para compilar. " +
          "ATENÇÃO: provas mock NÃO são válidas para verificação on-chain Soroban.",
      );
      this.mockMode = true;
    } else {
      this.logger.log("Artefatos ZK encontrados — modo real ativado");
    }
  }

  public isMockMode(): boolean {
    return this.mockMode;
  }

  public getArtifactsDir(): string {
    return this.artifactsDir;
  }

  public async generateProof(input: ZkProofInput): Promise<ZkProofResult> {
    this.logger.log(`Gerando prova ZK (${this.mockMode ? "mock" : "real"}) — kycLevel=${input.kycLevel}, minKycLevel=${input.minKycLevel}`);

    if (this.mockMode) {
      return this.buildMockProof(input);
    }

    return this.buildRealProof(input);
  }

  public loadVerificationKey(): EncodedVerificationKey {
    const vkPath = path.join(this.artifactsDir, "verification_key.json");
    if (!fs.existsSync(vkPath)) {
      throw new Error('verification_key.json não encontrado. Configure ZK_ARTIFACTS_DIR corretamente.');
    }
    const vk = JSON.parse(fs.readFileSync(vkPath, "utf-8")) as Record<string, unknown>;
    return encodeVerificationKey(vk);
  }

  private buildRealProof(input: ZkProofInput): Promise<ZkProofResult> {
    return new Promise<ZkProofResult>((resolve, reject) => {
      const wasmPath = path.join(this.artifactsDir, "vesta_kyc_js", "vesta_kyc.wasm");
      const zkeyPath = path.join(this.artifactsDir, "vesta_kyc_final.zkey");

      const normalized = input.fullName
        .toUpperCase()
        .trim()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/\s+/g, " ");
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
      const workerFile = path.join(__dirname, `zk.worker${ext}`);
      const execArgv = ext === ".ts" ? ["-r", "ts-node/register/transpile-only"] : [];

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
