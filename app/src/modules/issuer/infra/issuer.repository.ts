import { Injectable } from "@nestjs/common";
import { PrismaService } from "@src/infra/database/@prisma/prisma.service";
import { Issuer } from "@src/modules/issuer/domain/issuer.entity";
import { IIssuerRepository } from "@src/modules/issuer/domain/issuer.repository";
import { IssuerMapper } from "@src/modules/issuer/infra/issuer.mapper";

@Injectable()
export class IssuerRepository implements IIssuerRepository {
  public constructor(private readonly prismaService: PrismaService) {}

  public async findByExternalId(externalId: string): Promise<Issuer | null> {
    const record = await this.prismaService.issuer.findUnique({
      where: { issuerId: externalId },
    });
    if (!record) return null;
    return IssuerMapper.toDomain(record);
  }
}
