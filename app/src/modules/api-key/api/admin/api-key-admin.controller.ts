import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AdminSecret } from "@src/infra/auth/admin-secret.guard";
import { PublicEndpoint } from "@src/infra/auth/public.decorator";
import type {
  ApiKeyCreatedOutput,
  ApiKeyRevokedOutput,
  ApiKeyRotatedOutput,
} from "@src/modules/api-key/api/api-key.output";
import { ApiKeyAdminCreateInput } from "@src/modules/api-key/api/admin/inputs/api-key-admin-create.input";
import { ApiKeyAdminCreateCommand } from "@src/modules/api-key/application/admin/commands/api-key-admin-create.command";
import { ApiKeyAdminRevokeCommand } from "@src/modules/api-key/application/admin/commands/api-key-admin-revoke.command";
import { ApiKeyAdminRotateCommand } from "@src/modules/api-key/application/admin/commands/api-key-admin-rotate.command";
import { type ApiKeyAdminListResult } from "@src/modules/api-key/application/admin/handlers/api-key-admin-list.handler";
import { ApiKeyAdminListQuery } from "@src/modules/api-key/application/admin/queries/api-key-admin-list.query";

@ApiTags("admin")
@Controller("/admin/api-keys")
@PublicEndpoint()
@AdminSecret()
export class ApiKeyAdminController {
  public constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @ApiOperation({ summary: "Generate an API key for an issuer; the key is returned once" })
  @Post()
  public async create(@Body() input: ApiKeyAdminCreateInput): Promise<ApiKeyCreatedOutput> {
    const command = new ApiKeyAdminCreateCommand(input.name, input.issuerId);
    return this.commandBus.execute<ApiKeyAdminCreateCommand, ApiKeyCreatedOutput>(command);
  }

  @ApiOperation({ summary: "List every API key with its displayable prefix; secrets are never returned" })
  @Get()
  public async list(): Promise<ApiKeyAdminListResult> {
    return this.queryBus.execute<ApiKeyAdminListQuery, ApiKeyAdminListResult>(new ApiKeyAdminListQuery());
  }

  @ApiOperation({ summary: "Rotate an API key: a new one is returned once and the old one keeps working for 30 days" })
  @Post("/:id/rotate")
  public async rotate(@Param("id") id: string): Promise<ApiKeyRotatedOutput> {
    return this.commandBus.execute<ApiKeyAdminRotateCommand, ApiKeyRotatedOutput>(new ApiKeyAdminRotateCommand(id));
  }

  @ApiOperation({ summary: "Revoke an API key" })
  @Delete("/:id")
  public async revoke(@Param("id") id: string): Promise<ApiKeyRevokedOutput> {
    return this.commandBus.execute<ApiKeyAdminRevokeCommand, ApiKeyRevokedOutput>(new ApiKeyAdminRevokeCommand(id));
  }
}
