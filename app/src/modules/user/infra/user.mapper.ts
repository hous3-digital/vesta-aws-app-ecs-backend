import { User as UserPrisma } from "@prisma/client";
import { User, UserStatus } from "@src/modules/user/domain/user.entity";
import { Id } from "@src/shared/value-objects/id.value-object";
import { Name } from "@src/shared/value-objects/name.value-object";
import { Password } from "@src/shared/value-objects/password.value-object";

export class UserMapper {
  public static toDomain(prisma: UserPrisma): User {
    return User.restore({
      id: Id.restore(prisma.id),
      isActive: prisma.isActive,
      status: prisma.status as UserStatus,
      name: Name.restore(prisma.name),
      email: prisma.email,
      password: Password.restore(prisma.password),
      createdAt: prisma.createdAt,
      updatedAt: prisma.updatedAt,
      activatedAt: prisma.activatedAt,
      deactivatedAt: prisma.deactivatedAt,
    });
  }

  public static toJSON(domain: User): UserPrisma {
    return {
      id: domain.id.value,
      isActive: domain.isActive,
      status: domain.status,
      name: domain.name.value,
      email: domain.email,
      password: domain.password.value,
      createdAt: domain.createdAt,
      updatedAt: domain.updatedAt,
      activatedAt: domain.activatedAt,
      deactivatedAt: domain.deactivatedAt,
    };
  }
}
