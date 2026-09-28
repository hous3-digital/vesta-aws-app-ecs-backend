import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { BackofficeSession } from "@src/infra/auth/auth.types";
import { BackofficeAuth } from "@src/infra/auth/backoffice-auth.guard";
import { CurrentBackofficeUser } from "@src/infra/auth/current-backoffice-user.decorator";
import { PublicEndpoint } from "@src/infra/auth/public.decorator";
import type { ApiKeyCreatedOutput, ApiKeyRevokedOutput } from "@src/modules/api-key/api/api-key.output";
import { ApiKeyBackofficeCreateInput } from "@src/modules/api-key/api/backoffice/inputs/api-key-backoffice-create.input";
import { ApiKeyBackofficeCreateCommand } from "@src/modules/api-key/application/backoffice/commands/api-key-backoffice-create.command";
import { ApiKeyBackofficeRevokeCommand } from "@src/modules/api-key/application/backoffice/commands/api-key-backoffice-revoke.command";
import { type ApiKeyBackofficeListResult } from "@src/modules/api-key/application/backoffice/handlers/api-key-backoffice-list.handler";
import { ApiKeyBackofficeListQuery } from "@src/modules/api-key/application/backoffice/queries/api-key-backoffice-list.query";

@ApiTags("backoffice/api-keys")
@Controller("/backoffice/api-keys")
@PublicEndpoint()
@BackofficeAuth()
export class ApiKeyBackofficeController {
  public constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @ApiOperation({ summary: "Generate an API key bound to the logged issuer; the key is returned once" })
  @Post()
  public async create(
    @CurrentBackofficeUser() session: BackofficeSession,
    @Body() input: ApiKeyBackofficeCreateInput,
  ): Promise<ApiKeyCreatedOutput> {
    const command = new ApiKeyBackofficeCreateCommand(input.name, session.issuerId);
    return this.commandBus.execute<ApiKeyBackofficeCreateCommand, ApiKeyCreatedOutput>(command);
  }

  @ApiOperation({ summary: "List the logged issuer's API keys with their prefixes; secrets are never returned" })
  @Get()
  public async list(@CurrentBackofficeUser() session: BackofficeSession): Promise<ApiKeyBackofficeListResult> {
    const query = new ApiKeyBackofficeListQuery(session.issuerId);
    return this.queryBus.execute<ApiKeyBackofficeListQuery, ApiKeyBackofficeListResult>(query);
  }

  @ApiOperation({ summary: "Revoke one of the logged issuer's API keys" })
  @Delete("/:id")
  public async revoke(
    @CurrentBackofficeUser() session: BackofficeSession,
    @Param("id") id: string,
  ): Promise<ApiKeyRevokedOutput> {
    const command = new ApiKeyBackofficeRevokeCommand(id, session.issuerId);
    return this.commandBus.execute<ApiKeyBackofficeRevokeCommand, ApiKeyRevokedOutput>(command);
  }
}
