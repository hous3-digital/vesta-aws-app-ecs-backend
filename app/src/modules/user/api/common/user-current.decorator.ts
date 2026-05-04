import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { User } from "@src/modules/user/domain/user.entity";

export const UserCurrent = createParamDecorator((_data: unknown, ctx: ExecutionContext): User => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
