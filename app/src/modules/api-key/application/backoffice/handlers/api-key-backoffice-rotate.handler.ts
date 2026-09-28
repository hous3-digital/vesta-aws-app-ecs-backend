import { Injectable, Logger } from "@nestjs/common";
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import type { ApiKeyRotatedOutput } from "@src/modules/api-key/api/api-key.output";
import { ApiKeyBackofficeRotateCommand } from "@src/modules/api-key/application/backoffice/commands/api-key-backoffice-rotate.command";
import { IApiKeyRepository } from "@src/modules/api-key/domain/api-key.repository";
import { Id } from "@src/shared/value-objects/id.value-object";

/** Same two-write sequence as the admin rotation; the read is scoped by the session's issuer. */
@Injectable()
@CommandHandler(ApiKeyBackofficeRotateCommand)
export class ApiKeyBackofficeRotateHandler implements ICommandHandler<
  ApiKeyBackofficeRotateCommand,
  ApiKeyRotatedOutput
> {
  private readonly logger = new Logger(ApiKeyBackofficeRotateHandler.name);

  public constructor(private readonly apiKeyRepository: IApiKeyRepository) {}

  public async execute(command: ApiKeyBackofficeRotateCommand): Promise<ApiKeyRotatedOutput> {
    const current = await this.apiKeyRepository.findByIdForIssuerOrThrow(
      Id.restore(command.apiKeyId),
      command.issuerId,
    );
    const { next, secret, expiresAt } = current.rotate(new Date());
    await this.apiKeyRepository.saveOrThrow(next);
    await this.apiKeyRepository.updateOrThrow(current);

    this.logger.log(`API key rotated: ${current.id.value} replaced by ${next.id.value} for issuer ${command.issuerId}`);
    return {
      id: next.id.value,
      issuerId: command.issuerId,
      name: next.name,
      key: secret.value,
      keyPrefix: next.keyPrefix,
      createdAt: next.createdAt,
      previous: { id: current.id.value, expiresAt },
    };
  }
}
