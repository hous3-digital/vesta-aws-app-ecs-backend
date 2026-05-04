import { PrismaService } from "@src/infra/database/@prisma/prisma.service";
import { IMembershipRepository } from "@src/modules/membership/domain/membership.repository";
import { MembershipDataAccessObject } from "@src/modules/membership/infra/membership.data-access-object";
import { MembershipRepository } from "@src/modules/membership/infra/membership.repository";
import { IRoleRepository } from "@src/modules/role/domain/role.repository";
import { RoleRepository } from "@src/modules/role/infra/role.repository";
import { IUserRepository } from "@src/modules/user/domain/user.repository";
import { UserDataAccessObject } from "@src/modules/user/infra/user.data-access-object";
import { UserRepository } from "@src/modules/user/infra/user.repository";

// prettier-ignore
const DatabaseProvider = {
  // Services
  PrismaService,

  // Repositories
  UserRepository: { useClass: UserRepository, provide: IUserRepository },
  MembershipRepository: { useClass: MembershipRepository, provide: IMembershipRepository },
  RoleRepository: { useClass: RoleRepository, provide: IRoleRepository },

  // Data Access Objects
  UserDataAccessObject,
  MembershipDataAccessObject,
};

const DatabaseProviders = Object.values(DatabaseProvider);

export { DatabaseProvider, DatabaseProviders };
