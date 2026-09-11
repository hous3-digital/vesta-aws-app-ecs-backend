import { Controller, Get, Headers, HttpCode, Param, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { BackofficeAuth } from "@src/infra/auth/backoffice-auth.guard";
import { PublicEndpoint } from "@src/infra/auth/public.decorator";
import { CurrentIssuer } from "@src/modules/backoffice/shared/current-issuer.decorator";
import { PayoutRequestService } from "@src/modules/commission/payout-request.service";

@ApiTags("backoffice/payouts")
@PublicEndpoint()
@BackofficeAuth()
@Controller("/backoffice/payouts")
export class PayoutBackofficeController {
  public constructor(private readonly payouts: PayoutRequestService) {}

  @ApiOperation({ summary: "Reserva e solicita o repasse integral disponível" })
  @Post()
  @HttpCode(202)
  public request(
    @CurrentIssuer() issuerId: string,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    return this.payouts.requestAllAvailable(issuerId, idempotencyKey ?? "");
  }

  @ApiOperation({ summary: "Lista o histórico de repasses do issuer" })
  @Get()
  public list(@CurrentIssuer() issuerId: string, @Query("limit") limit?: string) {
    return this.payouts.list(issuerId, limit ? Number(limit) : 20);
  }

  @ApiOperation({ summary: "Consulta o repasse ativo do issuer" })
  @Get("/active")
  public active(@CurrentIssuer() issuerId: string) {
    return this.payouts.getActive(issuerId);
  }

  @ApiOperation({ summary: "Consulta os pré-requisitos técnicos do repasse" })
  @Get("/readiness")
  public readiness(@CurrentIssuer() issuerId: string) {
    return this.payouts.getReadiness(issuerId);
  }

  @ApiOperation({ summary: "Consulta um repasse e suas tentativas" })
  @Get("/:id")
  public detail(@CurrentIssuer() issuerId: string, @Param("id") id: string) {
    return this.payouts.get(issuerId, id);
  }
}
