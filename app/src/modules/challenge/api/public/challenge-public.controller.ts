import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ChallengeService } from "@src/modules/challenge/challenge.service";
import { CurrentApiKeyIssuer } from "@src/infra/auth/current-api-key-issuer.decorator";
import { PasskeyAuthService } from "@src/modules/challenge/passkey-auth.service";
import {
  PasskeyAuthenticationOptionsInput,
  PasskeyAuthenticationVerifyInput,
  PasskeyRegistrationOptionsInput,
  PasskeyRegistrationVerifyInput,
} from "@src/modules/challenge/api/public/inputs/passkey-auth.input";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { Throttle } from "@nestjs/throttler";

@ApiTags("auth")
@Controller("/public/auth")
export class ChallengePublicController {
  public constructor(
    private readonly challengeService: ChallengeService,
    private readonly passkeyAuthService: PasskeyAuthService,
  ) {}

  @ApiOperation({ summary: "Generate a one-time WebAuthn challenge (60s TTL)" })
  @ApiOkResponse({ description: "Challenge hex string and expiration timestamp" })
  @Get("/challenge")
  public async getChallenge(): Promise<{ challenge: string; expiresAt: number }> {
    return this.challengeService.generate();
  }

  @Post("/passkey/registration/options")
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  public registrationOptions(
    @CurrentApiKeyIssuer() issuerId: string,
    @Body() input: PasskeyRegistrationOptionsInput,
  ) {
    return this.passkeyAuthService.registrationOptions(issuerId, input.vcHash, input.rpId);
  }

  @Post("/passkey/registration/verify")
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  public verifyRegistration(
    @CurrentApiKeyIssuer() issuerId: string,
    @Body() input: PasskeyRegistrationVerifyInput,
  ) {
    return this.passkeyAuthService.verifyRegistration({
      issuerId,
      challenge: input.challenge,
      response: input.response as unknown as RegistrationResponseJSON,
    });
  }

  @Post("/passkey/authentication/options")
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  public authenticationOptions(
    @CurrentApiKeyIssuer() issuerId: string,
    @Body() input: PasskeyAuthenticationOptionsInput,
  ) {
    return this.passkeyAuthService.authenticationOptions(issuerId, input.rpId);
  }

  @Post("/passkey/authentication/verify")
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  public verifyAuthentication(
    @CurrentApiKeyIssuer() issuerId: string,
    @Body() input: PasskeyAuthenticationVerifyInput,
  ) {
    return this.passkeyAuthService.verifyAuthentication({
      issuerId,
      challenge: input.challenge,
      response: input.response as unknown as AuthenticationResponseJSON,
    });
  }
}
