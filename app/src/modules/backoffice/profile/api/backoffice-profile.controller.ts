import { Controller, Get } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PublicEndpoint } from "@src/infra/auth/public.decorator";
import { type BackofficeProfileResult } from "@src/modules/backoffice/profile/application/handlers/backoffice-profile.handler";
import { BackofficeProfileQuery } from "@src/modules/backoffice/profile/application/queries/backoffice-profile.query";
import { CurrentIssuer } from "@src/modules/backoffice/shared/current-issuer.decorator";

@ApiTags("backoffice/profile")
@PublicEndpoint()
@Controller("/backoffice/profile")
export class BackofficeProfileController {
  public constructor(private readonly queryBus: QueryBus) {}

  @ApiOperation({ summary: "Perfil do issuer atual no backoffice" })
  @Get()
  public async getProfile(@CurrentIssuer() issuerId: string): Promise<BackofficeProfileResult> {
    return this.queryBus.execute<BackofficeProfileQuery, BackofficeProfileResult>(
      new BackofficeProfileQuery(issuerId),
    );
  }
}
