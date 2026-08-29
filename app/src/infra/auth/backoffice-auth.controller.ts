import { BadRequestException, Body, Controller, Get, Post, UnauthorizedException } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { BackofficeAuthService } from "@src/infra/auth/backoffice-auth.service";
import { BackofficeAuth } from "@src/infra/auth/backoffice-auth.guard";
import type { AuthenticatedRequest } from "@src/infra/auth/auth.types";
import { CurrentBackofficeUser } from "@src/infra/auth/current-backoffice-user.decorator";
import { PublicEndpoint } from "@src/infra/auth/public.decorator";

interface LoginBody {
  email: string;
  password: string;
}

interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
}

@ApiTags("backoffice/auth")
@Controller("/backoffice/auth")
export class BackofficeAuthController {
  public constructor(private readonly authService: BackofficeAuthService) {}

  @ApiOperation({ summary: "Login do backoffice por email e senha" })
  @PublicEndpoint()
  @Post("/login")
  public async login(@Body() body: LoginBody) {
    if (!body.email || !body.password) {
      throw new UnauthorizedException("email and password are required");
    }

    return this.authService.login(body.email, body.password);
  }

  @ApiOperation({ summary: "Sessao atual do backoffice" })
  @PublicEndpoint()
  @BackofficeAuth()
  @Get("/me")
  public async me(@CurrentBackofficeUser() user: AuthenticatedRequest["backofficeUser"]) {
    return { user };
  }

  @ApiOperation({ summary: "Altera a senha do usuário autenticado e revoga sessões anteriores" })
  @PublicEndpoint()
  @BackofficeAuth()
  @Post("/password")
  public async changePassword(
    @CurrentBackofficeUser() user: NonNullable<AuthenticatedRequest["backofficeUser"]>,
    @Body() body: ChangePasswordBody,
  ) {
    if (typeof body.currentPassword !== "string" || typeof body.newPassword !== "string") {
      throw new BadRequestException("currentPassword and newPassword are required");
    }
    return this.authService.changePassword(user, body.currentPassword, body.newPassword);
  }
}
