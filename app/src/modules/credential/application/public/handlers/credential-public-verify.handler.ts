import { Injectable, NotFoundException } from "@nestjs/common";
import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { CredentialPublicVerifyQuery } from "@src/modules/credential/application/public/queries/credential-public-verify.query";
import { ICredentialRepository } from "@src/modules/credential/domain/credential.repository";
import { v4 as uuidv4 } from "uuid";

export type CredentialVerifyResult =
  | { valid: false; reason: "revoked" | "expired" | "not_found"; vcHash: string; expiresAt?: Date }
  | { valid: true; vcHash: string; kycLevel: string; issuerId: string; expiresAt: string; challengeNonce: string };

@Injectable()
@QueryHandler(CredentialPublicVerifyQuery)
export class CredentialPublicVerifyHandler implements IQueryHandler<CredentialPublicVerifyQuery, CredentialVerifyResult> {
  public constructor(private readonly credentialRepository: ICredentialRepository) {}

  public async execute(query: CredentialPublicVerifyQuery): Promise<CredentialVerifyResult> {
    const credential = await this.credentialRepository.findByVcHash(query.vcHash);

    if (!credential) {
      throw new NotFoundException(`Credencial não encontrada: ${query.vcHash}`);
    }

    if (credential.isRevoked()) {
      return { valid: false, reason: "revoked", vcHash: query.vcHash };
    }

    if (credential.isExpired()) {
      return { valid: false, reason: "expired", vcHash: query.vcHash, expiresAt: credential.expiresAt };
    }

    return {
      valid: true,
      vcHash: query.vcHash,
      kycLevel: credential.kycLevel,
      issuerId: credential.issuerId,
      expiresAt: credential.expiresAt.toISOString(),
      challengeNonce: uuidv4(),
    };
  }
}
