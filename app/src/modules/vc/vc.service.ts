import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { createHash } from "crypto";
import { v4 as uuidv4 } from "uuid";
import type { KycLevel, VestaVC } from "@src/shared/types/vesta-vc.types";

interface PoseidonInstance {
  (inputs: bigint[]): Uint8Array;
  F: { toString: (v: Uint8Array) => string };
}

@Injectable()
export class VcService implements OnModuleInit {
  private readonly logger = new Logger(VcService.name);
  private poseidon: PoseidonInstance | null = null;

  public async onModuleInit(): Promise<void> {
    try {
      const { buildPoseidon } = await import("circomlibjs");
      this.poseidon = (await buildPoseidon()) as PoseidonInstance;
      this.logger.log("Poseidon hash (BN254) initialized");
    } catch (err) {
      this.logger.error("Failed to initialize Poseidon", err);
    }
  }

  public async poseidonHash(inputs: bigint[]): Promise<string> {
    if (!this.poseidon) {
      const { buildPoseidon } = await import("circomlibjs");
      this.poseidon = (await buildPoseidon()) as PoseidonInstance;
    }
    const result = this.poseidon(inputs);
    return this.poseidon.F.toString(result);
  }

  public async hashCpf(cpf: string): Promise<string> {
    const clean = cpf.replace(/\D/g, "");
    return this.poseidonHash([BigInt(clean)]);
  }

  public async hashBirthDate(birthDate: string): Promise<string> {
    const numeric = birthDate.replace(/\D/g, "");
    return this.poseidonHash([BigInt(numeric)]);
  }

  public async hashFullName(fullName: string): Promise<string> {
    const normalized = this.normalizeFullName(fullName);
    const hex = Buffer.from(normalized).toString("hex");
    const chunk = hex.slice(0, 60);
    return this.poseidonHash([BigInt("0x" + chunk)]);
  }

  public normalizeFullName(fullName: string): string {
    return fullName
      .toUpperCase()
      .trim()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ");
  }

  public hashVC(vc: VestaVC): string {
    const canonical = JSON.stringify(vc, Object.keys(vc).sort());
    return createHash("sha256").update(canonical).digest("hex");
  }

  public async generateVC(params: {
    cpf: string;
    fullName: string;
    birthDate: string;
    kycLevel: KycLevel;
    kycMethod: string;
    issuerId: string;
    issuerName: string;
    nationality: string;
    expirationDays?: number;
  }): Promise<{ vc: VestaVC; vcHash: string }> {
    const [cpfHash, birthDateHash, fullNameHash] = await Promise.all([
      this.hashCpf(params.cpf),
      this.hashBirthDate(params.birthDate),
      this.hashFullName(params.fullName),
    ]);

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + (params.expirationDays ?? 365));

    const vc: VestaVC = {
      "@context": ["https://www.w3.org/2018/credentials/v1", "https://vesta.id/credentials/kyc/v1"],
      id: `urn:uuid:${uuidv4()}`,
      type: ["VerifiableCredential", "VestaKYCCredential"],
      issuer: {
        id: `did:web:vesta.id:issuers:${params.issuerId}`,
        name: params.issuerName,
      },
      issuance_date: now.toISOString(),
      expiration_date: expiresAt.toISOString(),
      credential_subject: {
        id: `did:key:${uuidv4()}`,
        cpf_hash: cpfHash,
        birth_date_hash: birthDateHash,
        full_name_hash: fullNameHash,
        kyc_level: params.kycLevel,
        kyc_provider: params.issuerId,
        kyc_method: params.kycMethod,
        nationality: params.nationality,
      },
      proof: {
        type: "PoseidonSignature2024",
        created: now.toISOString(),
        verificationMethod: `did:web:vesta.id:issuers:${params.issuerId}#key-1`,
        proofPurpose: "assertionMethod",
        proofValue: `z${createHash("sha256").update(`${params.issuerId}:${cpfHash}`).digest("base64url")}`,
      },
    };

    const vcHash = this.hashVC(vc);
    return { vc, vcHash };
  }

  public kycLevelToInt(level: KycLevel): number {
    const map: Record<KycLevel, number> = { basic: 1, intermediate: 2, complete: 3 };
    return map[level];
  }
}
