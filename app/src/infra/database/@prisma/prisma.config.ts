import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL as string,
  },
  migrations: {
    seed: "ts-node -r tsconfig-paths/register src/infra/database/seeds/index.ts",
  },
});
