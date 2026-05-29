import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PublicEndpoint } from "@src/infra/auth/public.decorator";

@ApiTags("health")
@Controller("/health")
@PublicEndpoint()
export class HealthController {
  @ApiOperation({ summary: "Health check" })
  @Get()
  public check() {
    return { status: "ok" };
  }
}
