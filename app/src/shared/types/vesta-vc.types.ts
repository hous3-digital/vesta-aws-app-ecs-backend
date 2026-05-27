export type KycLevel = "basic" | "intermediate" | "complete";

export interface VestaVCCredentialSubject {
  id: string;
  cpf_hash: string;
  birth_date_hash: string;
  full_name_hash: string;
  kyc_level: KycLevel;
  kyc_provider: string;
  kyc_method: string;
  nationality: string;
}

export interface VestaVCProof {
  type: string;
  created: string;
  verificationMethod: string;
  proofPurpose: string;
  proofValue: string;
}

export interface VestaVCIssuer {
  id: string;
  name: string;
}

export interface VestaVC {
  "@context": string[];
  id: string;
  type: string[];
  issuer: VestaVCIssuer;
  issuance_date: string;
  expiration_date: string;
  credential_subject: VestaVCCredentialSubject;
  proof: VestaVCProof;
}

export interface Groth16Proof {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
  protocol: string;
  curve: string;
}

export interface EncodedProof {
  proofA: Buffer;
  proofB: Buffer;
  proofC: Buffer;
  negatedA: Buffer;
}

export interface EncodedVerificationKey {
  alpha: Buffer;
  beta: Buffer;
  gamma: Buffer;
  delta: Buffer;
  ic: Buffer[];
}

export interface ZkProofInput {
  cpfHash: string;
  birthDateHash: string;
  fullNameHash: string;
  kycLevel: number;
  minKycLevel: number;
  cpf: string;
  birthDate: string;
  fullName: string;
}

export interface ZkProofResult {
  proof: Groth16Proof;
  publicSignals: string[];
  encodedProof: EncodedProof;
  encodedPublicSignals: Buffer[];
  proofHash: string;
}
