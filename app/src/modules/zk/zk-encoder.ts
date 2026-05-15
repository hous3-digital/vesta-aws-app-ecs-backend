import type { EncodedProof, EncodedVerificationKey, Groth16Proof } from "@src/shared/types/vesta-vc.types";

const FP_MODULUS = BigInt("21888242871839275222246405745257275088696311157297823662689037894645226208583");

function bigintToBytes32(value: bigint): Buffer {
  const buf = Buffer.alloc(32);
  let v = value;
  for (let i = 31; i >= 0; i--) {
    buf[i] = Number(v & BigInt(0xff));
    v >>= BigInt(8);
  }
  return buf;
}

export function encodeG1(point: string[]): Buffer {
  const X = BigInt(point[0]);
  const Y = BigInt(point[1]);
  const Z = BigInt(point[2]);

  if (Z === BigInt(0)) {
    return Buffer.alloc(64);
  }

  const zInv = modInverse(Z, FP_MODULUS);
  const xAffine = (X * zInv) % FP_MODULUS;
  const yAffine = (Y * zInv) % FP_MODULUS;

  return Buffer.concat([bigintToBytes32(xAffine), bigintToBytes32(yAffine)]);
}

export function negateG1(point: string[]): Buffer {
  const X = BigInt(point[0]);
  const Y = BigInt(point[1]);
  const Z = BigInt(point[2]);

  if (Z === BigInt(0)) {
    return Buffer.alloc(64);
  }

  const zInv = modInverse(Z, FP_MODULUS);
  const xAffine = (X * zInv) % FP_MODULUS;
  const yAffine = (Y * zInv) % FP_MODULUS;
  const yNeg = (FP_MODULUS - yAffine) % FP_MODULUS;

  return Buffer.concat([bigintToBytes32(xAffine), bigintToBytes32(yNeg)]);
}

export function encodeG2(point: string[][]): Buffer {
  const xC0 = BigInt(point[0][0]);
  const xC1 = BigInt(point[0][1]);
  const yC0 = BigInt(point[1][0]);
  const yC1 = BigInt(point[1][1]);
  const zC0 = BigInt(point[2][0]);
  const zC1 = BigInt(point[2][1]);

  if (zC0 === BigInt(0) && zC1 === BigInt(0)) {
    return Buffer.alloc(128);
  }

  if (zC0 === BigInt(1) && zC1 === BigInt(0)) {
    return Buffer.concat([bigintToBytes32(xC1), bigintToBytes32(xC0), bigintToBytes32(yC1), bigintToBytes32(yC0)]);
  }

  const { c0: zInvC0, c1: zInvC1 } = fp2Inverse(zC0, zC1);
  const { c0: xAffC0, c1: xAffC1 } = fp2Mul(xC0, xC1, zInvC0, zInvC1);
  const { c0: yAffC0, c1: yAffC1 } = fp2Mul(yC0, yC1, zInvC0, zInvC1);

  return Buffer.concat([bigintToBytes32(xAffC1), bigintToBytes32(xAffC0), bigintToBytes32(yAffC1), bigintToBytes32(yAffC0)]);
}

export function encodeFr(value: string): Buffer {
  return bigintToBytes32(BigInt(value));
}

export function encodeProof(proof: Groth16Proof): EncodedProof {
  return {
    proofA: encodeG1(proof.pi_a),
    proofB: encodeG2(proof.pi_b),
    proofC: encodeG1(proof.pi_c),
    negatedA: negateG1(proof.pi_a),
  };
}

export function encodeVerificationKey(vk: Record<string, unknown>): EncodedVerificationKey {
  const alpha = encodeG1(vk["vk_alpha_1"] as string[]);
  const beta = encodeG2(vk["vk_beta_2"] as string[][]);
  const gamma = encodeG2(vk["vk_gamma_2"] as string[][]);
  const delta = encodeG2(vk["vk_delta_2"] as string[][]);
  const ic = (vk["IC"] as string[][]).map((point) => encodeG1(point));

  return { alpha, beta, gamma, delta, ic };
}

function modInverse(a: bigint, m: bigint): bigint {
  let [old_r, r] = [a, m];
  let [old_s, s] = [BigInt(1), BigInt(0)];

  while (r !== BigInt(0)) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }

  return ((old_s % m) + m) % m;
}

function fp2Mul(aC0: bigint, aC1: bigint, bC0: bigint, bC1: bigint): { c0: bigint; c1: bigint } {
  const c0 = (aC0 * bC0 - aC1 * bC1 + FP_MODULUS * BigInt(2)) % FP_MODULUS;
  const c1 = (aC0 * bC1 + aC1 * bC0) % FP_MODULUS;
  return { c0, c1 };
}

function fp2Inverse(c0: bigint, c1: bigint): { c0: bigint; c1: bigint } {
  const norm = (c0 * c0 + c1 * c1) % FP_MODULUS;
  const normInv = modInverse(norm, FP_MODULUS);
  return {
    c0: (c0 * normInv) % FP_MODULUS,
    c1: ((FP_MODULUS - c1) * normInv) % FP_MODULUS,
  };
}
