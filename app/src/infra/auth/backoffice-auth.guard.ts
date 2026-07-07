import { applyDecorators, CanActivate, ExecutionContext, Injectable, UnauthorizedException, UseGuards } from "@nestjs/common";
import { BackofficeAuthService } from "@src/infra/auth/backoffice-auth.service";
import type { AuthenticatedRequest } from "@src/infra/auth/auth.types";

@Injectable()
export class BackofficeAuthGuard implements CanActivate {
  public constructor(private readonly authService: BackofficeAuthService) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const raw = request.headers.authorization;
    const authorization = Array.isArray(raw) ? raw[0] : raw;

    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing backoffice bearer token");
    }

    request.backofficeUser = await this.authService.verifyBearer(authorization.slice("Bearer ".length));
    return true;
  }
}

export const BackofficeAuth = () => applyDecorators(UseGuards(BackofficeAuthGuard));
