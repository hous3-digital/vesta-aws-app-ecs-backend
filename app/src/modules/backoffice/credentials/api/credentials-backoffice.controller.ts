import { Controller, Get, Param, Query } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { BackofficeAuth } from "@src/infra/auth/backoffice-auth.guard";
import { PublicEndpoint } from "@src/infra/auth/public.decorator";
import { type CredentialDetailResult } from "@src/modules/backoffice/credentials/application/handlers/credential-detail.handler";
import { type CredentialListResult } from "@src/modules/backoffice/credentials/application/handlers/credential-list.handler";
import { CredentialDetailQuery } from "@src/modules/backoffice/credentials/application/queries/credential-detail.query";
import { CredentialListQuery } from "@src/modules/backoffice/credentials/application/queries/credential-list.query";
import { CredentialListInput } from "@src/modules/backoffice/credentials/api/inputs/credential-list.input";
import { CurrentIssuer } from "@src/modules/backoffice/shared/current-issuer.decorator";

@ApiTags("backoffice/credentials")
@PublicEndpoint()
@BackofficeAuth()
@Controller("/backoffice/credentials")
export class CredentialsBackofficeController {
  public constructor(private readonly queryBus: QueryBus) {}

  @ApiOperation({ summary: "Lista credenciais do issuer logado" })
  @Get("/")
  public async list(
    @CurrentIssuer() issuerId: string,
    @Query() input: CredentialListInput,
  ): Promise<CredentialListResult> {
    const query = new CredentialListQuery(issuerId, input.status, input.limit ?? 20, input.cursor);
    return this.queryBus.execute<CredentialListQuery, CredentialListResult>(query);
  }

  @ApiOperation({ summary: "Detalhe de uma credencial" })
  @Get("/:id")
  public async detail(
    @CurrentIssuer() issuerId: string,
    @Param("id") id: string,
  ): Promise<CredentialDetailResult> {
    return this.queryBus.execute<CredentialDetailQuery, CredentialDetailResult>(
      new CredentialDetailQuery(issuerId, id),
    );
  }
}
