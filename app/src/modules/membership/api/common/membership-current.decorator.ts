import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Membership } from "@src/modules/membership/domain/membership.entity";

export const MembershipCurrent = createParamDecorator((data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest();
  return request.membership as Membership;
});
