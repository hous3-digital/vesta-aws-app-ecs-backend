import { Injectable, Logger } from "@nestjs/common";
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import type { ApiKeyCreatedOutput } from "@src/modules/api-key/api/api-key.output";
import { ApiKeyAdminCreateCommand } from "@src/modules/api-key/application/admin/commands/api-key-admin-create.command";
import { ApiKey } from "@src/modules/api-key/domain/api-key.entity";
import { IApiKeyRepository } from "@src/modules/api-key/domain/api-key.repository";

@Injectable()
@CommandHandler(ApiKeyAdminCreateCommand)
export class ApiKeyAdminCreateHandler implements ICommandHandler<ApiKeyAdminCreateCommand, ApiKeyCreatedOutput> {
  private readonly logger = new Logger(ApiKeyAdminCreateHandler.name);

  public constructor(private readonly apiKeyRepository: IApiKeyRepository) {}

  public async execute(command: ApiKeyAdminCreateCommand): Promise<ApiKeyCreatedOutput> {
    const { apiKey, secret } = ApiKey.create({ name: command.name, issuerId: command.issuerId });
    await this.apiKeyRepository.saveOrThrow(apiKey);

    this.logger.log(`API key created: ${apiKey.id.value} for issuer ${command.issuerId}`);
    return {
      id: apiKey.id.value,
      issuerId: command.issuerId,
      name: apiKey.name,
      key: secret.value,
      keyPrefix: apiKey.keyPrefix,
      createdAt: apiKey.createdAt,
    };
  }
}
