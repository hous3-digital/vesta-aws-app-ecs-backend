import { User } from "@src/modules/user/domain/user.entity";
import { Id } from "@src/shared/value-objects/id.value-object";

export abstract class IUserRepository {
  abstract findByIdOrThrow(id: Id): Promise<User>;
  abstract findByEmail(email: string): Promise<User | null>;
  abstract saveOrThrow(user: User): Promise<User>;
  abstract updateOrThrow(user: User): Promise<User>;
}
