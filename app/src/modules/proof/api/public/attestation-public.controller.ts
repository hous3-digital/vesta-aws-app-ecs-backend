import { Controller, Get, Param } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { AttestationIssuerResolutionQuery } from "@src/modules/proof/application/public/queries/attestation-issuer-resolution.query";

@ApiTags("attestations")
@Controller("/public/attestations")
export class AttestationPublicController {
  public constructor(private readonly queryBus: QueryBus) {}

  @ApiOperation({ summary: "Resolve o participante registrado a partir de uma attestation" })
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get("/:attestationId/issuer")
  public async resolveIssuer(@Param("attestationId") attestationId: string) {
    return this.queryBus.execute(new AttestationIssuerResolutionQuery(attestationId));
  }
}
