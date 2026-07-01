import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PublicEndpoint } from "@src/infra/auth/public.decorator";
import { VerifierCreateCommand } from "@src/modules/backoffice/verifiers/application/commands/verifier-create.command";
import { VerifierUpdateStatusCommand } from "@src/modules/backoffice/verifiers/application/commands/verifier-update-status.command";
import { type VerifierCreateResult } from "@src/modules/backoffice/verifiers/application/handlers/verifier-create.handler";
import { type VerifierListItem } from "@src/modules/backoffice/verifiers/application/handlers/verifier-list.handler";
import { type VerifierUpdateStatusResult } from "@src/modules/backoffice/verifiers/application/handlers/verifier-update-status.handler";
import { VerifierListQuery } from "@src/modules/backoffice/verifiers/application/queries/verifier-list.query";
import { VerifierCreateInput } from "@src/modules/backoffice/verifiers/api/inputs/verifier-create.input";
import { VerifierUpdateStatusInput } from "@src/modules/backoffice/verifiers/api/inputs/verifier-update-status.input";

@ApiTags("backoffice/verifiers")
@PublicEndpoint()
@Controller("/backoffice/admin/verifiers")
export class VerifiersBackofficeController {
  public constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @ApiOperation({ summary: "Cria um verifier (parceiro consumidor)" })
  @Post("/")
  public async create(@Body() input: VerifierCreateInput): Promise<VerifierCreateResult> {
    const command = new VerifierCreateCommand(input.id, input.name);
    return this.commandBus.execute<VerifierCreateCommand, VerifierCreateResult>(command);
  }

  @ApiOperation({ summary: "Lista todos os verifiers cadastrados" })
  @Get("/")
  public async list(): Promise<VerifierListItem[]> {
    return this.queryBus.execute<VerifierListQuery, VerifierListItem[]>(new VerifierListQuery());
  }

  @ApiOperation({ summary: "Atualiza status (active/revoked) de um verifier" })
  @Patch("/:id")
  public async updateStatus(
    @Param("id") id: string,
    @Body() input: VerifierUpdateStatusInput,
  ): Promise<VerifierUpdateStatusResult> {
    const command = new VerifierUpdateStatusCommand(id, input.status);
    return this.commandBus.execute<VerifierUpdateStatusCommand, VerifierUpdateStatusResult>(command);
  }
}
