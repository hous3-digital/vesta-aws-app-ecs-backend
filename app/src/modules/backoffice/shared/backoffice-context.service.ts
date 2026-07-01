import { Inject, Injectable, Scope, UnauthorizedException } from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import type { Request } from "express";

/**
 * Resolve o issuer atual do backoffice a partir do header X-Vesta-Issuer-ID
 * (mesmo header que o SDK ja usa em todo request). Enquanto nao ha auth,
 * o frontend do backoffice envia esse header para dizer quem esta acessando.
 *
 * Request-scoped porque le do request. Quando OTP entrar, este service vira
 * o ponto onde a claim `sub` do JWT eh lida — nenhum handler precisa mudar.
 */
@Injectable({ scope: Scope.REQUEST })
export class BackofficeContextService {
  public constructor(@Inject(REQUEST) private readonly request: Request) {}

  public getCurrentIssuerId(): string {
    const raw = this.request.headers["x-vesta-issuer-id"];
    const issuerId = Array.isArray(raw) ? raw[0] : raw;

    if (!issuerId || !issuerId.trim()) {
      throw new UnauthorizedException("Header X-Vesta-Issuer-ID obrigatorio no backoffice");
    }

    return issuerId.trim();
  }
}
