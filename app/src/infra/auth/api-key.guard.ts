import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AuthenticatedRequest } from "@src/infra/auth/auth.types";
import { PUBLIC_ENDPOINT_KEY } from "@src/infra/auth/public.decorator";
import { ApiKeySecret } from "@src/modules/api-key/domain/api-key-secret.value-object";
import { IApiKeyRepository } from "@src/modules/api-key/domain/api-key.repository";

/** Stable codes a client can branch on; the body keeps the shape `DomainErrorFilter` uses. */
export type ApiKeyAuthCode = "API_KEY_MISSING" | "API_KEY_INVALID" | "API_KEY_EXPIRED";

/**
 * Global guard of every route that is not `@PublicEndpoint()`. It resolves the
 * presented key by its hash, compares in constant time and applies the entity's
 * usability rule. A revoked key answers `API_KEY_INVALID`, not a code of its own:
 * revocation is the issuer's decision and must not be distinguishable by the
 * caller. Nothing of the key, not even a prefix, reaches the log.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  public constructor(
    private readonly reflector: Reflector,
    private readonly apiKeyRepository: IApiKeyRepository,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ENDPOINT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const rawApiKey = request.headers["x-api-key"] ?? request.headers.authorization;
    const header = Array.isArray(rawApiKey) ? rawApiKey[0] : rawApiKey;
    const presented = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : header;

    if (!presented) {
      throw ApiKeyGuard.unauthorized("API_KEY_MISSING", "Missing X-Api-Key header");
    }

    const candidate = ApiKeySecret.fromRaw(presented);
    const apiKey = await this.apiKeyRepository.findByHash(candidate.hash);
    const now = new Date();

    if (!apiKey || !candidate.matchesHash(apiKey.keyHash) || !apiKey.active || apiKey.issuerId === null) {
      this.logger.warn("Invalid API key attempt");
      throw ApiKeyGuard.unauthorized("API_KEY_INVALID", "Invalid API key");
    }

    if (apiKey.isExpired(now)) {
      this.logger.warn(`Expired API key attempt: ${apiKey.id.value}`);
      throw ApiKeyGuard.unauthorized("API_KEY_EXPIRED", "API key expired after rotation; generate a new key");
    }

    request.apiKey = { apiKeyId: apiKey.id.value, issuerId: apiKey.issuerId };
    return true;
  }

  private static unauthorized(code: ApiKeyAuthCode, message: string): UnauthorizedException {
    return new UnauthorizedException({ statusCode: 401, code, message, error: "Unauthorized" });
  }
}
