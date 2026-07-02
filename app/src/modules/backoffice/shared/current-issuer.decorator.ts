import { ExecutionContext, UnauthorizedException, createParamDecorator } from "@nestjs/common";
import type { Request } from "express";

/**
 * Extrai o issuerId do backoffice a partir do header X-Vesta-Issuer-ID
 * (mesmo header que o SDK publico ja usa). Enquanto nao ha auth, este e o
 * ponto unico de resolucao — quando o OTP entrar, sera trocado por leitura
 * do JWT.
 *
 * Nao usa Scope.REQUEST porque o CqrsModule nao propaga scope corretamente
 * para command/query handlers, gerando 500 na instanciacao. A abordagem
 * idiomatica com CQRS eh passar issuerId como parte do command/query.
 */
export const CurrentIssuer = createParamDecorator<undefined>(
  (_data, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const raw = request.headers["x-vesta-issuer-id"];
    const issuerId = Array.isArray(raw) ? raw[0] : raw;

    if (!issuerId || !issuerId.trim()) {
      throw new UnauthorizedException("Header X-Vesta-Issuer-ID obrigatorio no backoffice");
    }

    return issuerId.trim();
  },
);
