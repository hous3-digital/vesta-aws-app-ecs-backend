import { Injectable } from "@nestjs/common";
import { PrismaService } from "@src/infra/database/@prisma/prisma.service";
import { ApiKey } from "@src/modules/api-key/domain/api-key.entity";
import { IApiKeyRepository } from "@src/modules/api-key/domain/api-key.repository";
import { ApiKeyMapper } from "@src/modules/api-key/infra/api-key.mapper";
import { NotFoundError } from "@src/shared/errors";
import { Id } from "@src/shared/value-objects/id.value-object";

@Injectable()
export class ApiKeyRepository implements IApiKeyRepository {
  public constructor(private readonly prismaService: PrismaService) {}

  public async findByHash(keyHash: string): Promise<ApiKey | null> {
    const record = await this.prismaService.apiKey.findUnique({ where: { keyHash } });
    if (!record) return null;
    return ApiKeyMapper.toDomain(record);
  }

  public async findByIdOrThrow(id: Id): Promise<ApiKey> {
    const record = await this.prismaService.apiKey.findUnique({ where: { id: id.value } });
    if (!record) throw new NotFoundError("API_KEY_NOT_FOUND", "API key not found", { apiKeyId: id.value });
    return ApiKeyMapper.toDomain(record);
  }

  public async saveOrThrow(apiKey: ApiKey): Promise<ApiKey> {
    await this.prismaService.apiKey.create({ data: ApiKeyMapper.toCreateInput(apiKey) });
    return apiKey;
  }

  public async updateOrThrow(apiKey: ApiKey): Promise<ApiKey> {
    await this.prismaService.apiKey.update({
      where: { id: apiKey.id.value },
      data: ApiKeyMapper.toUpdateInput(apiKey),
    });
    return apiKey;
  }
}
