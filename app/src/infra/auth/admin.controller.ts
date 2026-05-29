import { Body, Controller, Delete, Get, Param, Post, UnauthorizedException } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PublicEndpoint } from "@src/infra/auth/public.decorator";
import { AdminSecret } from "@src/infra/auth/admin-secret.guard";
import { ApiKeyService } from "@src/infra/auth/api-key.service";

@ApiTags("admin")
@Controller("/admin/api-keys")
@PublicEndpoint()
@AdminSecret()
export class AdminController {
  public constructor(private readonly apiKeyService: ApiKeyService) {}

  @ApiOperation({ summary: "Generate a new API key" })
  @Post()
  public async create(@Body() body: { name: string }) {
    if (!body.name || typeof body.name !== "string") {
      throw new UnauthorizedException("name is required");
    }
    return this.apiKeyService.create(body.name.trim());
  }

  @ApiOperation({ summary: "List all API keys (key values are hidden)" })
  @Get()
  public async list() {
    return this.apiKeyService.list();
  }

  @ApiOperation({ summary: "Revoke an API key" })
  @Delete("/:id")
  public async revoke(@Param("id") id: string) {
    const revoked = await this.apiKeyService.revoke(id);
    if (!revoked) {
      throw new UnauthorizedException("API key not found or already revoked");
    }
    return { revoked: true, id };
  }
}
