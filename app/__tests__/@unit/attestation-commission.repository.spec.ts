import { AttestationRepository } from "@src/modules/proof/infra/attestation.repository";
import { Attestation } from "@src/modules/proof/domain/attestation.entity";
import type { PrismaService } from "@src/infra/database/@prisma/prisma.service";
import type { EnvService } from "@src/infra/env/env.service";

function attestation(params?: Partial<{ onChainResult: boolean; issuerId: string | null }>) {
  return Attestation.create({
    vcHash: "vc_hash",
    proofHash: "proof_hash",
    verifierId: "verifier",
    kycLevel: "basic",
    sorobanTxHash: "stellar_tx",
    sorobanLedger: 123,
    onChainResult: params?.onChainResult ?? true,
    issuerId: params?.issuerId === undefined ? "issuer_a" : params.issuerId,
    userWalletAddress: "GUSER",
  });
}

describe("AttestationRepository commission accrual", () => {
  function setup() {
    const attestationCreate = jest.fn().mockResolvedValue({});
    const commissionCreate = jest.fn().mockResolvedValue({});
    const transaction = jest.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations));
    const prisma = {
      attestation: { create: attestationCreate },
      commissionLedgerEntry: { create: commissionCreate },
      $transaction: transaction,
    } as unknown as PrismaService;
    const env = {
      COMMISSION_PER_VERIFICATION_BRL: 1.37,
      COMMISSION_SECURITY_HOURS: 48,
    } as EnvService;
    return { repository: new AttestationRepository(prisma, env), attestationCreate, commissionCreate, transaction };
  }

  it("persists the issuer snapshot and exactly 137 minor units in one transaction", async () => {
    const { repository, attestationCreate, commissionCreate, transaction } = setup();

    await repository.saveOrThrow(attestation());

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(attestationCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ issuerId: "issuer_a", onChainResult: true }),
    }));
    expect(commissionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ issuerId: "issuer_a", amountMinor: 137, currency: "BRL" }),
    }));
  });

  it("does not create a financial entry when Stellar rejects the attestation", async () => {
    const { repository, commissionCreate, transaction } = setup();
    await repository.saveOrThrow(attestation({ onChainResult: false }));
    expect(commissionCreate).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("keeps an unresolved issuer observable without attributing a commission", async () => {
    const { repository, commissionCreate } = setup();
    await repository.saveOrThrow(attestation({ issuerId: null }));
    expect(commissionCreate).not.toHaveBeenCalled();
  });
});
