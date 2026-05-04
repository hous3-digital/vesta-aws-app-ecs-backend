import { Controller, Get, UseGuards } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { AuthAuthenticateGuard } from "@src/modules/auth/api/common/auth-authenticate.guard";
import { MembershipSearchOutput } from "@src/modules/membership/api/common/membership.output";
import { MembershipPublicFindManyQuery } from "@src/modules/membership/application/public/queries/membership-public-find-many.query";
import { UserCurrent } from "@src/modules/user/api/common/user-current.decorator";
import { User } from "@src/modules/user/domain/user.entity";
import { ApiOkResponseData } from "@src/utils/decorators/api-ok-response-data.decorator";
import {
  ApiForbiddenErrorOutput,
  ApiInternalServerErrorOutput,
  ApiNotFoundErrorOutput,
  ApiUnauthorizedErrorOutput,
} from "@src/utils/types/api.output";

@ApiTags("membership")
@Controller("public/membership")
export class MembershipPublicController {
  public constructor(private readonly queryBus: QueryBus) {}

  @ApiBearerAuth()
  @ApiOperation({ summary: "Get user memberships" })
  @ApiOkResponseData(MembershipSearchOutput, true)
  @ApiUnauthorizedResponse({ type: ApiUnauthorizedErrorOutput })
  @ApiNotFoundResponse({ type: ApiNotFoundErrorOutput })
  @ApiForbiddenResponse({ type: ApiForbiddenErrorOutput })
  @ApiInternalServerErrorResponse({ type: ApiInternalServerErrorOutput })
  @UseGuards(AuthAuthenticateGuard)
  @Get("/")
  public async memberships(@UserCurrent() user: User): Promise<MembershipSearchOutput[]> {
    const query = new MembershipPublicFindManyQuery(user);
    return this.queryBus.execute<MembershipPublicFindManyQuery, MembershipSearchOutput[]>(query);
  }
}
