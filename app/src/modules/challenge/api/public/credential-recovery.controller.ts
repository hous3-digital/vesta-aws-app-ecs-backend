import { Body, Controller, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { CurrentApiKeyIssuer } from "@src/infra/auth/current-api-key-issuer.decorator";
import { CredentialRecoveryInput } from "@src/modules/challenge/api/public/inputs/credential-recovery.input";
import { CredentialRecoveryService } from "@src/modules/challenge/credential-recovery.service";

@ApiTags("credential")
@Controller("/public/credential")
export class CredentialRecoveryController {
  public constructor(private readonly recoveryService: CredentialRecoveryService) {}

  @ApiOperation({ summary: "Recover a VC after a verified synced-Passkey assertion" })
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post("/recover")
  public recover(
    @CurrentApiKeyIssuer() issuerId: string,
    @Body() input: CredentialRecoveryInput,
  ) {
    return this.recoveryService.recover(issuerId, input.recoveryToken);
  }
}
