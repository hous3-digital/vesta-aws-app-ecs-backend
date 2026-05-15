import { Injectable } from "@nestjs/common";
import { PrismaService } from "@src/infra/database/@prisma/prisma.service";

@Injectable()
export class CredentialDataAccessObject {
  public constructor(private readonly prismaService: PrismaService) {}

  public async findByVcHash(vcHash: string) {
    return this.prismaService.credential.findUnique({ where: { vcHash } });
  }

  public async listByIssuerId(issuerId: string, pageNumber = 1, pageSize = 20) {
    const skip = (pageNumber - 1) * pageSize;
    const [records, total] = await Promise.all([
      this.prismaService.credential.findMany({
        where: { issuerId },
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      this.prismaService.credential.count({ where: { issuerId } }),
    ]);
    return { records, total, pageNumber, pageSize };
  }
}
