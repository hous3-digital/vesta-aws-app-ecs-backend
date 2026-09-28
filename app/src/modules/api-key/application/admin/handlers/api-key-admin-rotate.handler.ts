import { Injectable, Logger } from "@nestjs/common";
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import type { ApiKeyRotatedOutput } from "@src/modules/api-key/api/api-key.output";
import { ApiKeyAdminRotateCommand } from "@src/modules/api-key/application/admin/commands/api-key-admin-rotate.command";
import { IApiKeyRepository } from "@src/modules/api-key/domain/api-key.repository";
import { Id } from "@src/shared/value-objects/id.value-object";

/**
 * Two writes without a transaction: if the second fails, a valid new key
 * exists and the old one has no expiry, a harmless state the operator fixes
 * by rotating again.
 */
@Injectable()
@CommandHandler(ApiKeyAdminRotateCommand)
export class ApiKeyAdminRotateHandler implements ICommandHandler<ApiKeyAdminRotateCommand, ApiKeyRotatedOutput> {
  private readonly logger = new Logger(ApiKeyAdminRotateHandler.name);

  public constructor(private readonly apiKeyRepository: IApiKeyRepository) {}

  public async execute(command: ApiKeyAdminRotateCommand): Promise<ApiKeyRotatedOutput> {
    const current = await this.apiKeyRepository.findByIdOrThrow(Id.restore(command.apiKeyId));
    const { next, secret, issuerId, expiresAt } = current.rotate(new Date());
    await this.apiKeyRepository.saveOrThrow(next);
    await this.apiKeyRepository.updateOrThrow(current);

    this.logger.log(`API key rotated: ${current.id.value} replaced by ${next.id.value} for issuer ${issuerId}`);
    return {
      id: next.id.value,
      issuerId,
      name: next.name,
      key: secret.value,
      keyPrefix: next.keyPrefix,
      createdAt: next.createdAt,
      previous: { id: current.id.value, expiresAt },
    };
  }
}
