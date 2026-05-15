import { Injectable } from "@nestjs/common";
import { PrismaService } from "@src/infra/database/@prisma/prisma.service";
import { Attestation } from "@src/modules/proof/domain/attestation.entity";
import { IAttestationRepository } from "@src/modules/proof/domain/attestation.repository";
import { AttestationMapper } from "@src/modules/proof/infra/attestation.mapper";

@Injectable()
export class AttestationRepository implements IAttestationRepository {
  public constructor(private readonly prismaService: PrismaService) {}

  public async saveOrThrow(attestation: Attestation): Promise<Attestation> {
    await this.prismaService.attestation.create({ data: AttestationMapper.toJSON(attestation) });
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
