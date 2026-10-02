import { Controller, Get, Res } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { PublicEndpoint } from "@src/infra/auth/public.decorator";
import { WalletService } from "@src/modules/wallet/application/services/wallet.service";
import type { Response } from "express";

@ApiExcludeController()
@PublicEndpoint()
@Controller("/.well-known")
export class WalletJwksController {
  public constructor(private readonly walletService: WalletService) {}

  @Get("/jwks.json")
  public getJwks(@Res() response: Response): void {
    // Resolve the keys first: a 503 from the service must not go out with a public cache header.
    const jwks = this.walletService.getCustomAuthJwks();
    response.setHeader("Cache-Control", "public, max-age=60");
    response.json(jwks);
  }
}
