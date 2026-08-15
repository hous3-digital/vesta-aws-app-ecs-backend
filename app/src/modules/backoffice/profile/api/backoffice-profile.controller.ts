import { Controller, Get } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { BackofficeAuth } from "@src/infra/auth/backoffice-auth.guard";
import { PublicEndpoint } from "@src/infra/auth/public.decorator";
import { type BackofficeProfileResult } from "@src/modules/backoffice/profile/application/handlers/backoffice-profile.handler";
import { BackofficeProfileQuery } from "@src/modules/backoffice/profile/application/queries/backoffice-profile.query";
import { CurrentIssuer } from "@src/modules/backoffice/shared/current-issuer.decorator";
import { WalletService } from "@src/modules/wallet/wallet.service";

@ApiTags("backoffice/profile")
@PublicEndpoint()
@BackofficeAuth()
@Controller("/backoffice/profile")
export class BackofficeProfileController {
  public constructor(
    private readonly queryBus: QueryBus,
    private readonly walletService: WalletService,
  ) {}

  @ApiOperation({ summary: "Perfil do issuer atual no backoffice" })
  @Get()
  public async getProfile(@CurrentIssuer() issuerId: string): Promise<BackofficeProfileResult> {
    return this.queryBus.execute<BackofficeProfileQuery, BackofficeProfileResult>(
      new BackofficeProfileQuery(issuerId),
    );
  }

  @ApiOperation({ summary: "Status público da wallet Stellar organizacional do issuer atual" })
  @Get("/wallet")
  public async getOrganizationWallet(@CurrentIssuer() issuerId: string) {
    return this.walletService.getOrganizationWallet(issuerId);
  }
}
