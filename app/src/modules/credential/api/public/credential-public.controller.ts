import { Body, Controller, Post } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { CredentialPublicIssueCommand } from "@src/modules/credential/application/public/commands/credential-public-issue.command";
import { CredentialPublicRevokeCommand } from "@src/modules/credential/application/public/commands/credential-public-revoke.command";
import { type CredentialIssueResult } from "@src/modules/credential/application/public/handlers/credential-public-issue.handler";
import { type CredentialRevokeResult } from "@src/modules/credential/application/public/handlers/credential-public-revoke.handler";
import { type CredentialVerifyResult } from "@src/modules/credential/application/public/handlers/credential-public-verify.handler";
import { CredentialPublicVerifyQuery } from "@src/modules/credential/application/public/queries/credential-public-verify.query";
import { CredentialPublicIssueInput } from "@src/modules/credential/api/public/inputs/credential-public-issue.input";
import { CredentialPublicRevokeInput } from "@src/modules/credential/api/public/inputs/credential-public-revoke.input";
import { CredentialPublicVerifyInput } from "@src/modules/credential/api/public/inputs/credential-public-verify.input";

@ApiTags("credential")
@Controller("/public/credential")
export class CredentialPublicController {
  public constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @ApiOperation({ summary: "Issue a Verifiable Credential (KYC)" })
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post("/")
  public async issue(@Body() input: CredentialPublicIssueInput): Promise<CredentialIssueResult> {
    const command = new CredentialPublicIssueCommand(
      input.issuerId,
      input.cpf,
      input.fullName,
      input.birthDate,
      input.kycLevel,
      input.kycMethod,
      input.nationality ?? "BR",
      input.expirationDays ?? 365,
    );
    return this.commandBus.execute<CredentialPublicIssueCommand, CredentialIssueResult>(command);
  }

  @ApiOperation({ summary: "Verify a Verifiable Credential status" })
  @Post("/verify")
  public async verify(@Body() input: CredentialPublicVerifyInput): Promise<CredentialVerifyResult> {
    const query = new CredentialPublicVerifyQuery(input.vcHash);
    return this.queryBus.execute<CredentialPublicVerifyQuery, CredentialVerifyResult>(query);
  }

  @ApiOperation({ summary: "Revoke a Verifiable Credential" })
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post("/revoke")
  public async revoke(@Body() input: CredentialPublicRevokeInput): Promise<CredentialRevokeResult> {
    const command = new CredentialPublicRevokeCommand(input.vcHash, input.reason);
    return this.commandBus.execute<CredentialPublicRevokeCommand, CredentialRevokeResult>(command);
  }
}
