import { ExecutionContext, UnauthorizedException, createParamDecorator } from "@nestjs/common";
import type { AuthenticatedRequest } from "@src/infra/auth/auth.types";

export const CurrentApiKeyIssuer = createParamDecorator<undefined>(
  (_data, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const issuerId = request.apiKey?.issuerId;
    if (!issuerId) {
      throw new UnauthorizedException("API key is not linked to an issuer");
    }
    return issuerId;
  },
);
