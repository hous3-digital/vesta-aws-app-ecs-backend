import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { EnvService } from "@src/infra/env/env.service";
import { ApiKeyService } from "@src/infra/auth/api-key.service";
import { PUBLIC_ENDPOINT_KEY } from "@src/infra/auth/public.decorator";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  public constructor(
    private readonly envService: EnvService,
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

    const request = context.switchToHttp().getRequest<{ headers: Record<string, string> }>();
    const apiKey = request.headers["x-api-key"];

    if (!apiKey) {
      throw new UnauthorizedException("Missing X-Api-Key header");
    }

    const isValid = await this.apiKeyService.validate(apiKey);

    if (!isValid) {
      this.logger.warn(`Invalid API key attempt: ${apiKey.slice(0, 12)}...`);
      throw new UnauthorizedException("Invalid API key");
    }

    return true;
  }
}
