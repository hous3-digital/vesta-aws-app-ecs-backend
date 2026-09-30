import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { EnvService } from "@src/infra/env/env.service";
import { ZkService } from "@src/modules/zk/application/services/zk.service";
import { mockEnvService } from "@test/mocks/service/env.service.mock";

type Artifact = "zkey" | "wasm";

const ZKEY_FILE = "vesta_kyc_final.zkey";
const WASM_FILE = path.join("vesta_kyc_js", "vesta_kyc.wasm");

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
  return dir;
};

const makeSut = (params: { mockMode: boolean; artifacts: Artifact[] }) => {
  const artifactsDir = artifactsDirWith(params.artifacts);
  const envService = mockEnvService({ ZK_ARTIFACTS_DIR: artifactsDir, ZK_MOCK_MODE: params.mockMode });
  const sut = new ZkService(envService as unknown as EnvService);
  return { sut, artifactsDir };
};

const missingArtifactCases: Array<[string, Artifact[]]> = [
  ["no artifact", []],
  ["only the zkey", ["zkey"]],
  ["only the wasm", ["wasm"]],
];

describe("ZkService boot", () => {
  afterAll(() => {
    for (const dir of createdDirs) fs.rmSync(dir, { recursive: true, force: true });
  });

  it.each(missingArtifactCases)(
    "CT-VESTA-SEC-005 refuses to boot with ZK_MOCK_MODE=false and %s, naming the directory and the files",
    (_label, artifacts) => {
      // Arrange
      const { sut, artifactsDir } = makeSut({ mockMode: false, artifacts });

      // Act
      const act = () => sut.onModuleInit();

      // Assert
      expect(act).toThrow(artifactsDir);
      expect(act).toThrow(ZKEY_FILE);
      expect(act).toThrow("vesta_kyc.wasm");
      expect(sut.isMockMode()).toBe(false);
    },
  );

  it("CT-VESTA-SEC-005 boots in mock mode with ZK_MOCK_MODE=true even without artifacts", () => {
    // Arrange
    const { sut } = makeSut({ mockMode: true, artifacts: [] });

    // Act
    sut.onModuleInit();

    // Assert
    expect(sut.isMockMode()).toBe(true);
  });

  it("CT-VESTA-SEC-005 boots in real mode with ZK_MOCK_MODE=false when both artifacts exist", () => {
    // Arrange
    const { sut } = makeSut({ mockMode: false, artifacts: ["zkey", "wasm"] });

    // Act
    sut.onModuleInit();

    // Assert
    expect(sut.isMockMode()).toBe(false);
  });
});
