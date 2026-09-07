import { NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import {
  IssuerRegistryGateway,
  IssuerRegistryUnavailableError,
  type RegistryCommissionTerm,
  type RegistryIssuerRole,
} from "@src/modules/issuer/issuer-registry.gateway";
import { AttestationIssuerResolutionQuery } from "@src/modules/proof/application/public/queries/attestation-issuer-resolution.query";
import { IAttestationRepository } from "@src/modules/proof/domain/attestation.repository";

export type AttestationIssuerRegistryStatus = "DID_NOT_AVAILABLE" | "NOT_REGISTERED" | "ACTIVE" | "SUSPENDED";

export interface AttestationIssuerResolutionResult {
  attestationId: string;
  issuer: {
    did: string | null;
    registryStatus: AttestationIssuerRegistryStatus;
    active: boolean;
    roles: RegistryIssuerRole[];
    payoutAddress: string | null;
    commissionTerms: RegistryCommissionTerm[];
    authorizedCredentialTypes: string[];
  };
}

@QueryHandler(AttestationIssuerResolutionQuery)
export class AttestationIssuerResolutionHandler implements IQueryHandler<
  AttestationIssuerResolutionQuery,
  AttestationIssuerResolutionResult
> {
  public constructor(
    private readonly attestationRepository: IAttestationRepository,
    private readonly registryGateway: IssuerRegistryGateway,
  ) {}

  public async execute(query: AttestationIssuerResolutionQuery): Promise<AttestationIssuerResolutionResult> {
    const attestationId = query.attestationId.trim();
    const attestation = attestationId ? await this.attestationRepository.findById(attestationId) : null;
    if (!attestation) throw new NotFoundException("Attestation not found");

    if (!attestation.issuerDid) {
      return this.unresolved(attestation.id.value, null, "DID_NOT_AVAILABLE");
    }

    let participant;
    try {
      participant = await this.registryGateway.getParticipant(attestation.issuerDid);
    } catch (cause) {
      if (cause instanceof IssuerRegistryUnavailableError) {
        throw new ServiceUnavailableException({
          statusCode: 503,
          error: "Issuer Registry Unavailable",
          code: cause.code,
          message: cause.message,
        });
      }
      throw cause;
    }

    if (!participant) {
      return this.unresolved(attestation.id.value, attestation.issuerDid, "NOT_REGISTERED");
    }

    return {
      attestationId: attestation.id.value,
      issuer: {
        did: participant.did,
        registryStatus: participant.status,
        active: participant.status === "ACTIVE",
        roles: participant.roles,
        payoutAddress: participant.payoutAddress,
        commissionTerms: participant.commissionTerms,
        authorizedCredentialTypes: participant.authorizedCredentialTypes,
      },
    };
  }

  private unresolved(
    attestationId: string,
    did: string | null,
    registryStatus: "DID_NOT_AVAILABLE" | "NOT_REGISTERED",
  ): AttestationIssuerResolutionResult {
    return {
      attestationId,
      issuer: {
        did,
        registryStatus,
        active: false,
        roles: [],
        payoutAddress: null,
        commissionTerms: [],
        authorizedCredentialTypes: [],
      },
    };
  }
}
