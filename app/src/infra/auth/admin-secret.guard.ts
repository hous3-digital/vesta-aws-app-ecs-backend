import { applyDecorators, CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException, UseGuards } from "@nestjs/common";
import { EnvService } from "@src/infra/env/env.service";

const ADMIN_GUARD_KEY = "adminSecretGuard";

@Injectable()
export class AdminSecretGuard implements CanActivate {
  public constructor(private readonly envService: EnvService) {}

  public canActivate(context: ExecutionContext): boolean {
    const adminSecret = this.envService.ADMIN_SECRET;

    if (!adminSecret) {
      throw new UnauthorizedException("ADMIN_SECRET is not configured");
    }

    const request = context.switchToHttp().getRequest<{ headers: Record<string, string> }>();
    const provided = request.headers["x-admin-secret"];

    if (!provided || provided !== adminSecret) {
      throw new UnauthorizedException("Invalid admin secret");
    }

    return true;
  }
}

/**
 * Protege um controller ou handler com o header X-Admin-Secret.
 * O valor deve corresponder à env var ADMIN_SECRET.
 */
export const AdminSecret = () =>
  applyDecorators(SetMetadata(ADMIN_GUARD_KEY, true), UseGuards(AdminSecretGuard));
