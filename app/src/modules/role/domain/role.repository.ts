import { Role, RoleType } from "@src/modules/role/domain/role.entity";
import { Id } from "@src/shared/value-objects/id.value-object";

export abstract class IRoleRepository {
  abstract findByIdOrThrow(id: Id): Promise<Role>;
  abstract findByTypeOrThrow(type: RoleType): Promise<Role>;
  abstract saveOrThrow(role: Role): Promise<Role>;
}
