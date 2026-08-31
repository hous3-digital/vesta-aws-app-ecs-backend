import { createHash } from "node:crypto";

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

export const commissionCreditId = (entryId: string): string => sha256(`vesta:commission:${entryId}`);

export const commissionBeneficiaryId = (issuerId: string): string => sha256(`vesta:issuer:${issuerId}`);

export const minorToAtomicUnits = (amountMinor: bigint, decimals: number): bigint => {
  if (amountMinor <= 0n) throw new Error("Valor da comissão deve ser positivo");
  if (decimals >= 2) return amountMinor * 10n ** BigInt(decimals - 2);
  const divisor = 10n ** BigInt(2 - decimals);
  if (amountMinor % divisor !== 0n) throw new Error("Valor não representável no ativo de liquidação");
  return amountMinor / divisor;
};
