import { Body, Controller, Post } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { UserOutput } from "@src/modules/user/api/common/user.output";
import { UserPublicCreateInput } from "@src/modules/user/api/public/inputs/user-public-create.input";
import { UserPublicCreateCommand } from "@src/modules/user/application/public/commands/user-public-create.command";
import { User } from "@src/modules/user/domain/user.entity";
import { UserMapper } from "@src/modules/user/infra/user.mapper";
import { ApiCreatedResponseData } from "@src/utils/decorators/api-created-response-data.decorator";
import { toOutput } from "@src/utils/helpers/to-output.helper";
import {
  ApiBadRequestErrorOutput,
  ApiConflictErrorOutput,
  ApiInternalServerErrorOutput,
} from "@src/utils/types/api.output";

@ApiTags("user")
@Controller("/public/user")
export class UserPublicController {
  public constructor(private readonly commandBus: CommandBus) {}

  @ApiOperation({ summary: "Create a new user" })
  @ApiCreatedResponseData(UserOutput)
  @ApiBadRequestResponse({ type: ApiBadRequestErrorOutput })
  @ApiConflictResponse({ type: ApiConflictErrorOutput })
  @ApiInternalServerErrorResponse({ type: ApiInternalServerErrorOutput })
  @Post("/")
  public async create(@Body() input: UserPublicCreateInput): Promise<UserOutput> {
    const command = new UserPublicCreateCommand(input.name, input.email, input.password);
    const user = await this.commandBus.execute<UserPublicCreateCommand, User>(command);
    return toOutput(UserOutput, UserMapper.toJSON(user));
  }
}
