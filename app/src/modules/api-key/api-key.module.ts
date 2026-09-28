import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { DatabaseModule } from "@src/infra/database/database.module";
import { IApiKeyRepository } from "@src/modules/api-key/domain/api-key.repository";
import { ApiKeyDataAccessObject } from "@src/modules/api-key/infra/api-key.data-access-object";
import { ApiKeyRepository } from "@src/modules/api-key/infra/api-key.repository";

@Module({
  imports: [DatabaseModule, CqrsModule],
  providers: [ApiKeyDataAccessObject, { provide: IApiKeyRepository, useClass: ApiKeyRepository }],
  exports: [IApiKeyRepository, ApiKeyDataAccessObject],
})
export class ApiKeyModule {}
