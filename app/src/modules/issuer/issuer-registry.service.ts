import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { PrismaService } from "@src/infra/database/@prisma/prisma.service";
import {
  IssuerRegistryGateway,
  IssuerRegistryUnavailableError,
  type RegistryCommissionTerm,
  type RegistryIssuerRole,
} from "@src/modules/issuer/issuer-registry.gateway";

@Injectable()
export class IssuerRegistryService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: IssuerRegistryGateway,
  ) {}

  public async registerOrUpdate(issuerId: string, rawCommissionTerms: unknown) {
    const normalizedIssuerId = issuerId.trim();
    if (!normalizedIssuerId) throw new BadRequestException("issuerId is required");

    const [issuer, wallet] = await Promise.all([
      this.prisma.issuer.findUnique({ where: { issuerId: normalizedIssuerId } }),
      this.prisma.organizationWallet.findUnique({ where: { issuerId: normalizedIssuerId } }),
    ]);
    if (!issuer) throw new NotFoundException("Issuer not found");
    if (!issuer.did) {
      throw new UnprocessableEntityException("Issuer does not have a canonical DID");
    }
    if (issuer.roles.length === 0) {
      throw new UnprocessableEntityException("Issuer does not have a registry role");
    }
    if (!wallet?.stellarAddress || wallet.status !== "ACTIVE") {
      throw new UnprocessableEntityException("Issuer does not have an active organization wallet");
    }

    const roles = issuer.roles as RegistryIssuerRole[];
    const commissionTerms = this.parseCommissionTerms(rawCommissionTerms, roles);

    let result;
    try {
      result = await this.gateway.registerOrUpdate({
        did: issuer.did,
        roles,
        payoutAddress: wallet.stellarAddress,
        commissionTerms,
        authorizedCredentialTypes: issuer.authorizedCredentialTypes,
      });
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

    if (result.participant.did !== issuer.did) {
      throw new ServiceUnavailableException("Issuer registry returned a different DID");
    }

    const registryStatus = result.participant.status === "ACTIVE" ? "REGISTERED" : "SUSPENDED";
    const confirmedAt = new Date();
    await this.prisma.issuer.update({
      where: { issuerId: normalizedIssuerId },
      data: {
        registryStatus,
        registryTransactionHash: result.txHash,
        registryLedger: result.ledger,
        registryConfirmedAt: confirmedAt,
      },
    });

    return {
      registry: {
        did: result.participant.did,
        roles: result.participant.roles,
        status: result.participant.status,
        active: result.participant.status === "ACTIVE",
        payoutAddress: result.participant.payoutAddress,
        commissionTerms: result.participant.commissionTerms,
        authorizedCredentialTypes: result.participant.authorizedCredentialTypes,
        registeredAt: result.participant.registeredAt,
        updatedAt: result.participant.updatedAt,
      },
      transaction: {
        operation: result.operation,
        hash: result.txHash,
        ledger: result.ledger,
        confirmedAt: confirmedAt.toISOString(),
      },
    };
  }

  private parseCommissionTerms(value: unknown, roles: RegistryIssuerRole[]): RegistryCommissionTerm[] {
    if (!Array.isArray(value) || value.length !== roles.length) {
      throw new BadRequestException("commissionTerms must contain exactly one entry for each issuer role");
    }

    const terms = value.map((raw): RegistryCommissionTerm => {
      if (!raw || typeof raw !== "object") {
        throw new BadRequestException("commissionTerms contains an invalid entry");
      }
      const entry = raw as Record<string, unknown>;
      if (entry.role !== "TECHNICAL" && entry.role !== "COMMERCIAL") {
        throw new BadRequestException("commissionTerms contains an unsupported role");
      }
      if (!Number.isInteger(entry.shareBps) || (entry.shareBps as number) < 0 || (entry.shareBps as number) > 10_000) {
        throw new BadRequestException("commissionTerms.shareBps must be an integer between 0 and 10000");
      }
      return { role: entry.role, shareBps: entry.shareBps as number };
    });

    if (new Set(terms.map((term) => term.role)).size !== terms.length) {
      throw new BadRequestException("commissionTerms contains duplicate roles");
    }
    if (roles.some((role) => !terms.some((term) => term.role === role))) {
      throw new BadRequestException("commissionTerms must match the issuer roles");
    }
    return terms;
  }
}
