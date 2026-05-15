import { PrismaService } from "@src/infra/database/@prisma/prisma.service";

// prettier-ignore
const DatabaseProvider = {
  PrismaService,
};

const DatabaseProviders = Object.values(DatabaseProvider);

export { DatabaseProvider, DatabaseProviders };
