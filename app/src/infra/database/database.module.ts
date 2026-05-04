import { Module } from "@nestjs/common";
import { DatabaseProviders } from "@src/infra/database/database.provider";

@Module({
  providers: DatabaseProviders,
  exports: DatabaseProviders,
})
export class DatabaseModule {}
