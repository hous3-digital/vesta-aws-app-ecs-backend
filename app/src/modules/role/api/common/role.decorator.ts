import { CustomDecorator, SetMetadata } from "@nestjs/common";
import { RoleType } from "@src/modules/role/domain/role.entity";

export const Roles = (...roles: RoleType[]): CustomDecorator<string> => SetMetadata("roles", roles);
