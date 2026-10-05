import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { EnvService } from "@src/infra/env/env.service";
import { ZkService } from "@src/modules/zk/application/services/zk.service";
import {
  GROTH16_FIXTURE_BINDING,
  GROTH16_FIXTURE_PROOF,
  GROTH16_FIXTURE_PUBLIC_SIGNALS,
} from "@test/constants/groth16-proof.constant";
import { mockEnvService } from "@test/mocks/service/env.service.mock";

type Artifact = "zkey" | "wasm" | "vk";

const ZKEY_FILE = "vesta_kyc_final.zkey";
const WASM_FILE = path.join("vesta_kyc_js", "vesta_kyc.wasm");
const VK_FILE = "verification_key.json";
const REAL_ARTIFACTS_DIR = path.resolve("zk-artifacts");

const createdDirs: string[] = [];

/** A temporary artifacts directory holding only the given files. Content is irrelevant: boot checks presence, not validity. */
const artifactsDirWith = (artifacts: Artifact[]): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vesta-zk-artifacts-"));
  createdDirs.push(dir);
  if (artifacts.includes("zkey")) fs.writeFileSync(path.join(dir, ZKEY_FILE), "");
  if (artifacts.includes("wasm")) {
    fs.mkdirSync(path.join(dir, "vesta_kyc_js"));
    fs.writeFileSync(path.join(dir, WASM_FILE), "");
  }
  if (artifacts.includes("vk")) fs.copyFileSync(path.join(REAL_ARTIFACTS_DIR, VK_FILE), path.join(dir, VK_FILE));
  return dir;
};

const makeSut = (params: { mockMode: boolean; artifactsDir: string }) => {
  const envService = mockEnvService({ ZK_ARTIFACTS_DIR: params.artifactsDir, ZK_MOCK_MODE: params.mockMode });
  const sut = new ZkService(envService as unknown as EnvService);
  return { sut };
};

const missingArtifactCases: Array<[string, Artifact[]]> = [
  ["no artifact", []],
  ["only the zkey", ["zkey"]],
  ["only the wasm", ["wasm"]],
  ["the zkey and the wasm but no verification key", ["zkey", "wasm"]],
];

describe("ZkService boot", () => {
  afterAll(() => {
    for (const dir of createdDirs) fs.rmSync(dir, { recursive: true, force: true });
  });

  it.each(missingArtifactCases)(
    "CT-VESTA-SEC-005 refuses to boot with ZK_MOCK_MODE=false and %s, naming the directory and the files",
    (_label, artifacts) => {
      // Arrange
      const artifactsDir = artifactsDirWith(artifacts);
      const { sut } = makeSut({ mockMode: false, artifactsDir });

      // Act
      const act = () => sut.onModuleInit();

      // Assert
      expect(act).toThrow(artifactsDir);
      expect(act).toThrow(ZKEY_FILE);
      expect(act).toThrow("vesta_kyc.wasm");
      expect(act).toThrow(VK_FILE);
      expect(sut.isMockMode()).toBe(false);
    },
  );

  it("CT-VESTA-SEC-005 boots in mock mode with ZK_MOCK_MODE=true even without artifacts", () => {
    // Arrange
    const { sut } = makeSut({ mockMode: true, artifactsDir: artifactsDirWith([]) });

    // Act
    sut.onModuleInit();

    // Assert
    expect(sut.isMockMode()).toBe(true);
  });

  it("CT-VESTA-SEC-005 boots in real mode with ZK_MOCK_MODE=false when the three artifacts exist", () => {
    // Arrange
    const { sut } = makeSut({ mockMode: false, artifactsDir: artifactsDirWith(["zkey", "wasm", "vk"]) });

    // Act
    sut.onModuleInit();

    // Assert
    expect(sut.isMockMode()).toBe(false);
  });

  it("hands the zero verification key in mock mode, where no artifact exists", () => {
    // Arrange
    const { sut } = makeSut({ mockMode: true, artifactsDir: artifactsDirWith([]) });

    // Act
    const vk = sut.loadVerificationKey();

    // Assert
    expect(vk.alpha).toEqual(Buffer.alloc(64));
    expect(vk.ic).toHaveLength(2);
  });
});

describe("ZkService verifyProof", () => {
  const realMode = () => makeSut({ mockMode: false, artifactsDir: REAL_ARTIFACTS_DIR });
  const tamperedProof = () => ({ ...GROTH16_FIXTURE_PROOF, pi_a: ["0", "0", "1"] });

  afterAll(async () => {
    // snarkjs keeps a bn128 thread pool alive after groth16.verify and only exposes it as a global.
    const curve = (globalThis as { curve_bn128?: { terminate: () => Promise<void> } }).curve_bn128;
    if (curve) await curve.terminate();
  });

  it("CT-VESTA-PROOF-008 accepts a real proof whose public signals match the credential hashes", async () => {
    // Arrange
    const { sut } = realMode();

    // Act
    const act = sut.verifyProof(GROTH16_FIXTURE_PROOF, GROTH16_FIXTURE_PUBLIC_SIGNALS, GROTH16_FIXTURE_BINDING);

    // Assert
    await expect(act).resolves.toBeUndefined();
  });

  it("CT-VESTA-PROOF-008 rejects a tampered proof with PROOF_INVALID", async () => {
    // Arrange
    const { sut } = realMode();

    // Act
    const act = sut.verifyProof(tamperedProof(), GROTH16_FIXTURE_PUBLIC_SIGNALS, GROTH16_FIXTURE_BINDING);

    // Assert
    await expect(act).rejects.toMatchObject({ code: "PROOF_INVALID" });
  });

  it("CT-VESTA-PROOF-008 rejects a valid proof of another credential with PROOF_PUBLIC_SIGNALS_MISMATCH", async () => {
    // Arrange
    const { sut } = realMode();
    const otherCredential = { ...GROTH16_FIXTURE_BINDING, cpfHash: "1" };

    // Act
    const act = sut.verifyProof(GROTH16_FIXTURE_PROOF, GROTH16_FIXTURE_PUBLIC_SIGNALS, otherCredential);

    // Assert
    await expect(act).rejects.toMatchObject({ code: "PROOF_PUBLIC_SIGNALS_MISMATCH" });
  });

  it("CT-VESTA-PROOF-008 rejects public signals that do not claim kyc_ok with PROOF_PUBLIC_SIGNALS_MISMATCH", async () => {
    // Arrange
    const { sut } = realMode();
    const notOk = ["0", ...GROTH16_FIXTURE_PUBLIC_SIGNALS.slice(1)];

    // Act
    const act = sut.verifyProof(GROTH16_FIXTURE_PROOF, notOk, GROTH16_FIXTURE_BINDING);

    // Assert
    await expect(act).rejects.toMatchObject({ code: "PROOF_PUBLIC_SIGNALS_MISMATCH" });
  });

  it("CT-VESTA-PROOF-008 rejects a wrong number of public signals with PROOF_PUBLIC_SIGNALS_MISMATCH", async () => {
    // Arrange
    const { sut } = realMode();
    const tooMany = [...GROTH16_FIXTURE_PUBLIC_SIGNALS, "1"];

    // Act
    const act = sut.verifyProof(GROTH16_FIXTURE_PROOF, tooMany, GROTH16_FIXTURE_BINDING);

    // Assert
    await expect(act).rejects.toMatchObject({ code: "PROOF_PUBLIC_SIGNALS_MISMATCH" });
  });

  it("resolves without checking in mock mode, where proofs are never valid", async () => {
    // Arrange
    const { sut } = makeSut({ mockMode: true, artifactsDir: REAL_ARTIFACTS_DIR });

    // Act
    const act = sut.verifyProof(tamperedProof(), ["1", "1"], GROTH16_FIXTURE_BINDING);

    // Assert
    await expect(act).resolves.toBeUndefined();
  });
});
