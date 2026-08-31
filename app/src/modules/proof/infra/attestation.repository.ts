import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@src/infra/database/@prisma/prisma.service";
import { EnvService } from "@src/infra/env/env.service";
import { Attestation } from "@src/modules/proof/domain/attestation.entity";
import { IAttestationRepository } from "@src/modules/proof/domain/attestation.repository";
import { AttestationMapper } from "@src/modules/proof/infra/attestation.mapper";
import { Id } from "@src/shared/value-objects/id.value-object";
import {
  commissionBeneficiaryId,
  commissionCreditId,
  minorToAtomicUnits,
} from "@src/modules/commission/commission-onchain-identifiers";

@Injectable()
export class AttestationRepository implements IAttestationRepository {
  private readonly logger = new Logger(AttestationRepository.name);

  public constructor(
    private readonly prismaService: PrismaService,
    private readonly envService: EnvService,
  ) {}

  public async saveOrThrow(attestation: Attestation): Promise<Attestation> {
    const attestationCreate = this.prismaService.attestation.create({
      data: AttestationMapper.toJSON(attestation),
    });

    if (!attestation.onChainResult) {
      await attestationCreate;
      return attestation;
    }

    if (!attestation.issuerId) {
      this.logger.error(`Attestation ${attestation.id.value} confirmada sem issuerId; comissão não registrada`);
      await attestationCreate;
      return attestation;
    }

    const occurredAt = attestation.createdAt;
    const availableAt = new Date(occurredAt.getTime() + this.envService.COMMISSION_SECURITY_MINUTES * 60 * 1000);
    const amountMinor = Math.round(this.envService.COMMISSION_PER_VERIFICATION_BRL * 100);
    const entryId = Id.create("commission").value;

    await this.prismaService.$transaction([
      attestationCreate,
      this.prismaService.commissionLedgerEntry.create({
        data: {
          id: entryId,
          issuerId: attestation.issuerId,
          attestationId: attestation.id.value,
          entryType: "ACCRUAL",
          status: availableAt <= new Date() ? "AVAILABLE" : "PENDING_SECURITY",
          amountMinor,
          currency: "BRL",
          source: "ATTESTATION_REUSE",
          occurredAt,
          availableAt,
          onChainCreditId: commissionCreditId(entryId),
          onChainBeneficiaryId: commissionBeneficiaryId(attestation.issuerId),
          onChainAmountAtomic: minorToAtomicUnits(BigInt(amountMinor), this.envService.STELLAR_PAYOUT_ASSET_DECIMALS),
          onChainStatus: "PENDING",
          onChainUpdatedAt: new Date(),
          createdAt: new Date(),
        },
      }),
    ]);
    return attestation;
  }

  public async findByVcHash(vcHash: string): Promise<Attestation[]> {
    const records = await this.prismaService.attestation.findMany({
      where: { vcHash },
      orderBy: { createdAt: "desc" },
    });
    return records.map(AttestationMapper.toDomain);
  }
}
