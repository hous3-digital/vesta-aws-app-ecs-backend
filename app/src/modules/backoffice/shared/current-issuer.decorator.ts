import { ExecutionContext, UnauthorizedException, createParamDecorator } from "@nestjs/common";
import type { AuthenticatedRequest } from "@src/infra/auth/auth.types";

/**
 * Extrai o issuerId do backoffice a partir da sessao autenticada.
 *
 * Nao usa Scope.REQUEST porque o CqrsModule nao propaga scope corretamente
 * para command/query handlers. A abordagem idiomatica com CQRS e passar
 * issuerId como parte do command/query.
 */
export const CurrentIssuer = createParamDecorator<undefined>(
  (_data, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const issuerId = request.backofficeUser?.issuerId;

    if (!issuerId) {
      throw new UnauthorizedException("Sessao do backoffice obrigatoria");
    }

    return issuerId;
  },
);
