import { ConflictException, Injectable } from "@nestjs/common";
import { PrismaService } from "@src/infra/database/@prisma/prisma.service";
import { Verifier } from "@src/modules/backoffice/verifiers/domain/verifier.entity";
import { IVerifierRepository } from "@src/modules/backoffice/verifiers/domain/verifier.repository";
import { VerifierMapper } from "@src/modules/backoffice/verifiers/infra/verifier.mapper";

@Injectable()
export class VerifierRepository implements IVerifierRepository {
  public constructor(private readonly prismaService: PrismaService) {}

  public async findById(id: string): Promise<Verifier | null> {
    const record = await this.prismaService.verifier.findUnique({ where: { id } });
    if (!record) return null;
    return VerifierMapper.toDomain(record);
  }

  public async findManyByIds(ids: string[]): Promise<Map<string, Verifier>> {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (unique.length === 0) return new Map();

    const records = await this.prismaService.verifier.findMany({
      where: { id: { in: unique } },
    });

    return new Map(records.map((r) => [r.id, VerifierMapper.toDomain(r)]));
  }

  public async listAll(): Promise<Verifier[]> {
    const records = await this.prismaService.verifier.findMany({
      orderBy: { createdAt: "desc" },
    });
    return records.map(VerifierMapper.toDomain);
  }

  public async saveOrThrow(verifier: Verifier): Promise<Verifier> {
    const existing = await this.prismaService.verifier.findUnique({ where: { id: verifier.id } });
    if (existing) {
      throw new ConflictException(`Verifier ja existe: ${verifier.id}`);
    }
    await this.prismaService.verifier.create({ data: VerifierMapper.toCreateInput(verifier) });
    return verifier;
  }

  public async updateOrThrow(verifier: Verifier): Promise<Verifier> {
    await this.prismaService.verifier.update({
      where: { id: verifier.id },
      data: VerifierMapper.toUpdateInput(verifier),
    });
    return verifier;
  }
}
