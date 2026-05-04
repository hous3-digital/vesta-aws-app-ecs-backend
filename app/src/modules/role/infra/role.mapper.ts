import { Role as RolePrisma } from "@prisma/client";
import { Role, RoleStatus, RoleType } from "@src/modules/role/domain/role.entity";
import { Id } from "@src/shared/value-objects/id.value-object";

export class RoleMapper {
  public static toDomain(prisma: RolePrisma): Role {
    return Role.restore({
      id: Id.restore(prisma.id),
      isActive: prisma.isActive,
      status: prisma.status as RoleStatus,
      type: prisma.type as RoleType,
      description: prisma.description,
      createdAt: prisma.createdAt,
      updatedAt: prisma.updatedAt,
      activatedAt: prisma.activatedAt,
      deactivatedAt: prisma.deactivatedAt,
    });
  }

  public static toJSON(domain: Role): RolePrisma {
    return {
      id: domain.id.value,
      isActive: domain.isActive,
      status: domain.status,
      type: domain.type,
      description: domain.description,
      createdAt: domain.createdAt,
      updatedAt: domain.updatedAt,
      activatedAt: domain.activatedAt,
      deactivatedAt: domain.deactivatedAt,
    };
  }
}
