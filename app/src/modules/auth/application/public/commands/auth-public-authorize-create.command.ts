import { User } from "@src/modules/user/domain/user.entity";
import { Id } from "@src/shared/value-objects/id.value-object";

export class AuthPublicAuthorizeCreateCommand {
  public constructor(
    public readonly membershipId: Id,
    public readonly user: User,
  ) {}
}
