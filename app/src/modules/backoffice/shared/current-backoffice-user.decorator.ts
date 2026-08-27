import { ExecutionContext, UnauthorizedException, createParamDecorator } from "@nestjs/common";
import type { AuthenticatedRequest, BackofficeSession } from "@src/infra/auth/auth.types";

export const CurrentBackofficeUser = createParamDecorator<undefined>(
  (_data, ctx: ExecutionContext): BackofficeSession => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.backofficeUser) throw new UnauthorizedException("Sessão do backoffice obrigatória");
    return request.backofficeUser;
  },
);
