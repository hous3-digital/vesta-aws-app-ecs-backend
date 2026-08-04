import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ApiKeyService } from "@src/infra/auth/api-key.service";
import type { AuthenticatedRequest } from "@src/infra/auth/auth.types";
import { PUBLIC_ENDPOINT_KEY } from "@src/infra/auth/public.decorator";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  public constructor(
    private readonly reflector: Reflector,
    private readonly apiKeyService: ApiKeyService,
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
    const apiKey = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : header;

    if (!apiKey) {
      throw new UnauthorizedException("Missing X-Api-Key header");
    }

    const apiKeyContext = await this.apiKeyService.resolve(apiKey);

    if (!apiKeyContext) {
      this.logger.warn(`Invalid API key attempt: ${apiKey.slice(0, 12)}...`);
      throw new UnauthorizedException("Invalid API key");
    }

    request.apiKey = apiKeyContext;
    return true;
  }
}
