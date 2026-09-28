import { Injectable, Logger } from "@nestjs/common";
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import type { ApiKeyRevokedOutput } from "@src/modules/api-key/api/api-key.output";
import { ApiKeyAdminRevokeCommand } from "@src/modules/api-key/application/admin/commands/api-key-admin-revoke.command";
import { IApiKeyRepository } from "@src/modules/api-key/domain/api-key.repository";
import { Id } from "@src/shared/value-objects/id.value-object";

@Injectable()
@CommandHandler(ApiKeyAdminRevokeCommand)
export class ApiKeyAdminRevokeHandler implements ICommandHandler<ApiKeyAdminRevokeCommand, ApiKeyRevokedOutput> {
  private readonly logger = new Logger(ApiKeyAdminRevokeHandler.name);

  public constructor(private readonly apiKeyRepository: IApiKeyRepository) {}

  public async execute(command: ApiKeyAdminRevokeCommand): Promise<ApiKeyRevokedOutput> {
    const apiKey = await this.apiKeyRepository.findByIdOrThrow(Id.restore(command.apiKeyId));
    apiKey.revoke(new Date());
    await this.apiKeyRepository.updateOrThrow(apiKey);

    this.logger.log(`API key revoked: ${apiKey.id.value} of issuer ${apiKey.issuerId ?? "none"}`);
    return { revoked: true, id: apiKey.id.value };
  }
}
