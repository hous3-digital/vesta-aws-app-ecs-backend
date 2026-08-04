import { ExecutionContext, UnauthorizedException, createParamDecorator } from "@nestjs/common";
import type { AuthenticatedRequest, BackofficeSession } from "@src/infra/auth/auth.types";

export const CurrentBackofficeUser = createParamDecorator<undefined>(
  (_data, ctx: ExecutionContext): BackofficeSession => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.backofficeUser;
    if (!user) {
      throw new UnauthorizedException("Sessao do backoffice obrigatoria");
    }
    return user;
  },
);
