import { Injectable, Logger } from "@nestjs/common";
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import type { ApiKeyRevokedOutput } from "@src/modules/api-key/api/api-key.output";
import { ApiKeyBackofficeRevokeCommand } from "@src/modules/api-key/application/backoffice/commands/api-key-backoffice-revoke.command";
import { IApiKeyRepository } from "@src/modules/api-key/domain/api-key.repository";
import { Id } from "@src/shared/value-objects/id.value-object";

@Injectable()
@CommandHandler(ApiKeyBackofficeRevokeCommand)
export class ApiKeyBackofficeRevokeHandler implements ICommandHandler<
  ApiKeyBackofficeRevokeCommand,
  ApiKeyRevokedOutput
> {
  private readonly logger = new Logger(ApiKeyBackofficeRevokeHandler.name);

  public constructor(private readonly apiKeyRepository: IApiKeyRepository) {}

  public async execute(command: ApiKeyBackofficeRevokeCommand): Promise<ApiKeyRevokedOutput> {
    const apiKey = await this.apiKeyRepository.findByIdForIssuerOrThrow(Id.restore(command.apiKeyId), command.issuerId);
    apiKey.revoke(new Date());
    await this.apiKeyRepository.updateOrThrow(apiKey);

    this.logger.log(`API key revoked: ${apiKey.id.value} of issuer ${command.issuerId}`);
    return { revoked: true, id: apiKey.id.value };
  }
}
