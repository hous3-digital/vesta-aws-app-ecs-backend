import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiInternalServerErrorResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { AuthAuthenticateGuard } from "@src/modules/auth/api/common/auth-authenticate.guard";
import { AuthOutput } from "@src/modules/auth/api/common/auth.output";
import { AuthPublicAuthenticateCreateInput } from "@src/modules/auth/api/public/inputs/auth-public-authenticate-create.input";
import { AuthPublicAuthorizeCreateInput } from "@src/modules/auth/api/public/inputs/auth-public-authorize-create.input";
import { AuthPublicAuthenticateCreateCommand } from "@src/modules/auth/application/public/commands/auth-public-authenticate-create.command";
import { AuthPublicAuthorizeCreateCommand } from "@src/modules/auth/application/public/commands/auth-public-authorize-create.command";
import { UserCurrent } from "@src/modules/user/api/common/user-current.decorator";
import { User } from "@src/modules/user/domain/user.entity";
import { Id } from "@src/shared/value-objects/id.value-object";
import { ApiCreatedResponseData } from "@src/utils/decorators/api-created-response-data.decorator";
import { toOutput } from "@src/utils/helpers/to-output.helper";
import {
  ApiBadRequestErrorOutput,
  ApiInternalServerErrorOutput,
  ApiUnauthorizedErrorOutput,
} from "@src/utils/types/api.output";

@ApiTags("auth")
@Controller("/public/auth")
export class AuthPublicController {
  public constructor(private readonly commandBus: CommandBus) {}

  @ApiOperation({ summary: "Authenticate an user and generate access token" })
  @ApiCreatedResponseData(AuthOutput)
  @ApiBadRequestResponse({ type: ApiBadRequestErrorOutput })
  @ApiUnauthorizedResponse({ type: ApiUnauthorizedErrorOutput })
  @ApiInternalServerErrorResponse({ type: ApiInternalServerErrorOutput })
  @Post("/authenticate")
  public async authenticate(@Body() input: AuthPublicAuthenticateCreateInput): Promise<AuthOutput> {
    const command = new AuthPublicAuthenticateCreateCommand(input.email, input.password);
    const authenticate = await this.commandBus.execute<AuthPublicAuthenticateCreateCommand, AuthOutput>(command);
    return toOutput(AuthOutput, authenticate);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: "Authorize an user and generate access token" })
  @ApiCreatedResponseData(AuthOutput)
  @ApiBadRequestResponse({ type: ApiBadRequestErrorOutput })
  @ApiUnauthorizedResponse({ type: ApiUnauthorizedErrorOutput })
  @ApiInternalServerErrorResponse({ type: ApiInternalServerErrorOutput })
  @UseGuards(AuthAuthenticateGuard)
  @Post("/authorize")
  public async authorize(
    @Body() input: AuthPublicAuthorizeCreateInput,
    @UserCurrent() user: User,
  ): Promise<AuthOutput> {
    const membershipId = Id.restore(input.membershipId);
    const command = new AuthPublicAuthorizeCreateCommand(membershipId, user);
    const authorize = await this.commandBus.execute<AuthPublicAuthorizeCreateCommand, AuthOutput>(command);
    return toOutput(AuthOutput, authorize);
  }
}
