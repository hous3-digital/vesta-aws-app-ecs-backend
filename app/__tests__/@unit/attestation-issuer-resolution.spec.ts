import { ServiceUnavailableException } from "@nestjs/common";
import { AttestationIssuerResolutionHandler } from "@src/modules/proof/application/public/handlers/attestation-issuer-resolution.handler";
import { AttestationIssuerResolutionQuery } from "@src/modules/proof/application/public/queries/attestation-issuer-resolution.query";
import { Attestation } from "@src/modules/proof/domain/attestation.entity";
import type { IAttestationRepository } from "@src/modules/proof/domain/attestation.repository";
import {
  IssuerRegistryGateway,
  IssuerRegistryUnavailableError,
  type RegistryParticipant,
} from "@src/modules/issuer/issuer-registry.gateway";

const did = "did:pkh:stellar:testnet:GISSUER";

function attestation(issuerDid: string | null) {
  return Attestation.create({
    vcHash: "vc_hash",
    proofHash: "proof_hash",
    verifierId: "verifier",
    kycLevel: "basic",
    sorobanTxHash: "proof_tx",
    sorobanLedger: 100,
    onChainResult: true,
    issuerId: "issuer_a",
    issuerDid,
    userWalletAddress: null,
  });
}

const activeParticipant: RegistryParticipant = {
  did,
  roles: ["TECHNICAL"],
  payoutAddress: "GPAYOUT",
  commissionTerms: [{ role: "TECHNICAL", shareBps: 2_750 }],
  authorizedCredentialTypes: ["VestaKYCCredential"],
  status: "ACTIVE",
  registeredAt: 100,
  updatedAt: 200,
};

describe("AttestationIssuerResolutionHandler", () => {
  function setup(issuerDid: string | null, resolved: RegistryParticipant | null = activeParticipant) {
    const record = attestation(issuerDid);
    const findById = jest.fn().mockResolvedValue(record);
    const getParticipant = jest.fn().mockResolvedValue(resolved);
    const handler = new AttestationIssuerResolutionHandler(
      { findById } as unknown as IAttestationRepository,
      { getParticipant } as unknown as IssuerRegistryGateway,
    );
    return { handler, record, getParticipant };
  }

  it("resolves an active registry participant without exposing the internal issuer ID", async () => {
    const { handler, record } = setup(did);
    const result = await handler.execute(new AttestationIssuerResolutionQuery(record.id.value));

    expect(result).toEqual({
      attestationId: record.id.value,
      issuer: {
        did,
        registryStatus: "ACTIVE",
        active: true,
        roles: ["TECHNICAL"],
        payoutAddress: "GPAYOUT",
        commissionTerms: [{ role: "TECHNICAL", shareBps: 2_750 }],
        authorizedCredentialTypes: ["VestaKYCCredential"],
      },
    });
    expect(JSON.stringify(result)).not.toContain("issuer_a");
  });

  it("distinguishes suspended, unregistered and missing-DID participants", async () => {
    const suspended = setup(did, { ...activeParticipant, status: "SUSPENDED" });
    await expect(
      suspended.handler.execute(new AttestationIssuerResolutionQuery(suspended.record.id.value)),
    ).resolves.toEqual(
      expect.objectContaining({ issuer: expect.objectContaining({ registryStatus: "SUSPENDED", active: false }) }),
    );

    const unregistered = setup(did, null);
    await expect(
      unregistered.handler.execute(new AttestationIssuerResolutionQuery(unregistered.record.id.value)),
    ).resolves.toEqual(
      expect.objectContaining({
        issuer: expect.objectContaining({ did, registryStatus: "NOT_REGISTERED", active: false }),
      }),
    );

    const missingDid = setup(null, null);
    await expect(
      missingDid.handler.execute(new AttestationIssuerResolutionQuery(missingDid.record.id.value)),
    ).resolves.toEqual(
      expect.objectContaining({
        issuer: expect.objectContaining({ did: null, registryStatus: "DID_NOT_AVAILABLE", active: false }),
      }),
    );
    expect(missingDid.getParticipant).not.toHaveBeenCalled();
  });

  it("does not turn an unavailable Soroban query into a not-registered answer", async () => {
    const { handler, record, getParticipant } = setup(did);
    getParticipant.mockRejectedValue(new IssuerRegistryUnavailableError("REGISTRY_RPC_UNAVAILABLE", "indisponível"));

    await expect(handler.execute(new AttestationIssuerResolutionQuery(record.id.value))).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
