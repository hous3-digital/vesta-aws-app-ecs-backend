import { User } from "@src/modules/user/domain/user.entity";

export class MembershipPublicFindManyQuery {
  public constructor(public readonly user: User) {}
}
