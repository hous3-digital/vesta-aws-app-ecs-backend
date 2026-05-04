import { Controller, Param, Patch, UseGuards } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { AuthAuthenticateGuard } from "@src/modules/auth/api/common/auth-authenticate.guard";
import { Roles } from "@src/modules/role/api/common/role.decorator";
import { RoleType } from "@src/modules/role/domain/role.entity";
import { UserBackofficeDeactivatePathParam } from "@src/modules/user/api/backoffice/params/user-backoffice-deactivate-path.param";
import { UserOutput } from "@src/modules/user/api/common/user.output";
import { UserBackofficeDeactivateCommand } from "@src/modules/user/application/backoffice/commands/user-backoffice-deactivate.command";
import { User } from "@src/modules/user/domain/user.entity";
import { UserMapper } from "@src/modules/user/infra/user.mapper";
import { Id } from "@src/shared/value-objects/id.value-object";
import { ApiOkResponseData } from "@src/utils/decorators/api-ok-response-data.decorator";
import { toOutput } from "@src/utils/helpers/to-output.helper";
import {
  ApiBadRequestErrorOutput,
  ApiConflictErrorOutput,
  ApiForbiddenErrorOutput,
  ApiInternalServerErrorOutput,
  ApiNotFoundErrorOutput,
  ApiUnauthorizedErrorOutput,
} from "@src/utils/types/api.output";

@ApiTags("user")
@Controller("/backoffice/user")
export class UserBackofficeController {
  public constructor(private readonly commandBus: CommandBus) {}

  @ApiOperation({ summary: "Deactivate user by id" })
  @ApiOkResponseData(UserOutput)
  @ApiBadRequestResponse({ type: ApiBadRequestErrorOutput })
  @ApiUnauthorizedResponse({ type: ApiUnauthorizedErrorOutput })
  @ApiForbiddenResponse({ type: ApiForbiddenErrorOutput })
  @ApiNotFoundResponse({ type: ApiNotFoundErrorOutput })
  @ApiConflictResponse({ type: ApiConflictErrorOutput })
  @ApiInternalServerErrorResponse({ type: ApiInternalServerErrorOutput })
  @UseGuards(AuthAuthenticateGuard)
  @Roles(RoleType.Admin)
  @Patch("/deactivate/:id")
  public async deactivate(@Param() param: UserBackofficeDeactivatePathParam): Promise<UserOutput> {
    const id = Id.restore(param.id);
    const command = new UserBackofficeDeactivateCommand(id);
    const user = await this.commandBus.execute<UserBackofficeDeactivateCommand, User>(command);
    return toOutput(UserOutput, UserMapper.toJSON(user));
  }
}
