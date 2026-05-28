import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ChallengeService } from "@src/modules/challenge/challenge.service";

@ApiTags("auth")
@Controller("/public/auth")
export class ChallengePublicController {
  public constructor(private readonly challengeService: ChallengeService) {}

  @ApiOperation({ summary: "Generate a one-time WebAuthn challenge (60s TTL)" })
  @ApiOkResponse({ description: "Challenge hex string and expiration timestamp" })
  @Get("/challenge")
  public async getChallenge(): Promise<{ challenge: string; expiresAt: number }> {
    return this.challengeService.generate();
  }
}
