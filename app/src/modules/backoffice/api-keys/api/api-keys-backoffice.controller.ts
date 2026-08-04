import { Body, Controller, Delete, Get, Param, Post, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ApiKeyService } from "@src/infra/auth/api-key.service";
import { BackofficeAuthGuard } from "@src/infra/auth/backoffice-auth.guard";
import { PublicEndpoint } from "@src/infra/auth/public.decorator";
import { CurrentIssuer } from "@src/modules/backoffice/shared/current-issuer.decorator";

@ApiTags("backoffice/api-keys")
@PublicEndpoint()
@UseGuards(BackofficeAuthGuard)
@Controller("/backoffice/api-keys")
export class ApiKeysBackofficeController {
  public constructor(private readonly apiKeyService: ApiKeyService) {}

  @ApiOperation({ summary: "Gera uma API key vinculada ao issuer logado" })
  @Post()
  public async create(@CurrentIssuer() issuerId: string, @Body() body: { name: string }) {
    if (!body.name || typeof body.name !== "string") {
      throw new UnauthorizedException("name is required");
    }

    return this.apiKeyService.create(body.name.trim(), issuerId);
  }

  @ApiOperation({ summary: "Lista API keys do issuer logado sem expor os segredos" })
  @Get()
  public async list(@CurrentIssuer() issuerId: string) {
    return this.apiKeyService.list(issuerId);
  }

  @ApiOperation({ summary: "Revoga uma API key do issuer logado" })
  @Delete("/:id")
  public async revoke(@CurrentIssuer() issuerId: string, @Param("id") id: string) {
    const revoked = await this.apiKeyService.revokeForIssuer(id, issuerId);
    if (!revoked) {
      throw new UnauthorizedException("API key not found or already revoked");
    }
    return { revoked: true, id };
  }
}
