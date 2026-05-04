import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@src/infra/database/@prisma/prisma.service";
import { Role, RoleType } from "@src/modules/role/domain/role.entity";
import { IRoleRepository } from "@src/modules/role/domain/role.repository";
import { RoleMapper } from "@src/modules/role/infra/role.mapper";
import { Id } from "@src/shared/value-objects/id.value-object";

@Injectable()
export class RoleRepository implements IRoleRepository {
  public constructor(private readonly prismaService: PrismaService) {}

  public async findByIdOrThrow(id: Id): Promise<Role> {
    const role = await this.prismaService.role.findUnique({
      where: { id: id.value },
    });

    if (!role) {
      throw new NotFoundException("Role not found");
    }

    return RoleMapper.toDomain(role);
  }

  public async findByTypeOrThrow(type: RoleType): Promise<Role> {
    const role = await this.prismaService.role.findFirst({
      where: { isActive: true, type: type },
    });

    if (!role) {
      throw new NotFoundException("Role not found");
    }

    return RoleMapper.toDomain(role);
  }

  public async saveOrThrow(role: Role): Promise<Role> {
    await this.prismaService.role.create({
      data: {
        id: role.id.value,
        isActive: role.isActive,
        status: role.status,
        type: role.type,
        description: role.description,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
      },
    });

    return role;
  }
}
