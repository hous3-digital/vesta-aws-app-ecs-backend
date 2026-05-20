import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@src/infra/database/@prisma/prisma.service";
import { Credential } from "@src/modules/credential/domain/credential.entity";
import { ICredentialRepository } from "@src/modules/credential/domain/credential.repository";
import { CredentialMapper } from "@src/modules/credential/infra/credential.mapper";
import { Id } from "@src/shared/value-objects/id.value-object";

@Injectable()
export class CredentialRepository implements ICredentialRepository {
  public constructor(private readonly prismaService: PrismaService) {}

  public async findByVcHash(vcHash: string): Promise<Credential | null> {
    const record = await this.prismaService.credential.findUnique({ where: { vcHash } });
    if (!record) return null;
    return CredentialMapper.toDomain(record);
  }

  public async findByCpfDedupKey(cpfDedupKey: string): Promise<Credential | null> {
    const record = await this.prismaService.credential.findUnique({ where: { cpfDedupKey } });
    if (!record) return null;
    return CredentialMapper.toDomain(record);
  }

  public async findByIdOrThrow(id: Id): Promise<Credential> {
    const record = await this.prismaService.credential.findUnique({ where: { id: id.value } });
    if (!record) throw new NotFoundException("Credencial não encontrada");
    return CredentialMapper.toDomain(record);
  }

  public async saveOrThrow(credential: Credential): Promise<Credential> {
    await this.prismaService.credential.create({ data: CredentialMapper.toCreateInput(credential) });
    return credential;
  }

  public async updateOrThrow(credential: Credential): Promise<Credential> {
    await this.prismaService.credential.update({
      where: { id: credential.id.value },
      data: CredentialMapper.toUpdateInput(credential),
    });
    return credential;
  }

  public async upsertByVcHash(credential: Credential): Promise<Credential> {
    await this.prismaService.credential.upsert({
      where: { vcHash: credential.vcHash },
      create: CredentialMapper.toCreateInput(credential),
      update: CredentialMapper.toUpdateInput(credential),
    });
    return credential;
  }
}
