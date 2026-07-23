import { Body, Controller, Post } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { CurrentApiKeyIssuer } from "@src/infra/auth/current-api-key-issuer.decorator";
import { CredentialPublicIssueCommand } from "@src/modules/credential/application/public/commands/credential-public-issue.command";
import { CredentialPublicKycStatusCommand } from "@src/modules/credential/application/public/commands/credential-public-kyc-status.command";
import { CredentialPublicRevokeCommand } from "@src/modules/credential/application/public/commands/credential-public-revoke.command";
import { type CredentialIssueResult } from "@src/modules/credential/application/public/handlers/credential-public-issue.handler";
import { type CredentialKycStatusResult } from "@src/modules/credential/application/public/handlers/credential-public-kyc-status.handler";
import { type CredentialRevokeResult } from "@src/modules/credential/application/public/handlers/credential-public-revoke.handler";
import { type CredentialVerifyResult } from "@src/modules/credential/application/public/handlers/credential-public-verify.handler";
import { CredentialPublicVerifyQuery } from "@src/modules/credential/application/public/queries/credential-public-verify.query";
import { CredentialPublicIssueInput } from "@src/modules/credential/api/public/inputs/credential-public-issue.input";
import { CredentialPublicKycStatusInput } from "@src/modules/credential/api/public/inputs/credential-public-kyc-status.input";
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
  public async issue(
    @CurrentApiKeyIssuer() issuerId: string,
    @Body() input: CredentialPublicIssueInput,
  ): Promise<CredentialIssueResult> {
    const command = new CredentialPublicIssueCommand(
      issuerId,
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

  @ApiOperation({
    summary: "Update async KYC decision (approved/rejected) for a PENDING credential",
  })
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @Post("/kyc-status")
  public async updateKycStatus(
    @CurrentApiKeyIssuer() issuerId: string,
    @Body() input: CredentialPublicKycStatusInput,
  ): Promise<CredentialKycStatusResult> {
    const command = new CredentialPublicKycStatusCommand(
      issuerId,
      input.cpf,
      input.status,
      input.kycLevel,
      input.reason,
    );
    return this.commandBus.execute<CredentialPublicKycStatusCommand, CredentialKycStatusResult>(
      command,
    );
  }
}
