import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { EnvService } from "@src/infra/env/env.service";
import { secretsMatch } from "@src/shared/crypto/secrets-match";

const ADMIN_GUARD_KEY = "adminSecretGuard";

@Injectable()
export class AdminSecretGuard implements CanActivate {
  public constructor(private readonly envService: EnvService) {}

  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const provided = request.headers["x-admin-secret"];

    // One answer for a missing header, a wrong length and a wrong value: nothing about the secret leaks.
    if (!provided || !secretsMatch(this.envService.ADMIN_SECRET, provided)) {
      throw new UnauthorizedException("Invalid admin secret");
    }

    return true;
  }
}

/**
 * Protects a controller or handler with the X-Admin-Secret header, compared in
 * constant time with ADMIN_SECRET (required by env.schema.ts in every environment).
 */
export const AdminSecret = () => applyDecorators(SetMetadata(ADMIN_GUARD_KEY, true), UseGuards(AdminSecretGuard));
