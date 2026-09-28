import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { DatabaseModule } from "@src/infra/database/database.module";
import { ApiKeyAdminController } from "@src/modules/api-key/api/admin/api-key-admin.controller";
import { ApiKeyBackofficeController } from "@src/modules/api-key/api/backoffice/api-key-backoffice.controller";
import { ApiKeyAdminCreateHandler } from "@src/modules/api-key/application/admin/handlers/api-key-admin-create.handler";
import { ApiKeyAdminListHandler } from "@src/modules/api-key/application/admin/handlers/api-key-admin-list.handler";
import { ApiKeyAdminRevokeHandler } from "@src/modules/api-key/application/admin/handlers/api-key-admin-revoke.handler";
import { ApiKeyBackofficeCreateHandler } from "@src/modules/api-key/application/backoffice/handlers/api-key-backoffice-create.handler";
import { ApiKeyBackofficeListHandler } from "@src/modules/api-key/application/backoffice/handlers/api-key-backoffice-list.handler";
import { ApiKeyBackofficeRevokeHandler } from "@src/modules/api-key/application/backoffice/handlers/api-key-backoffice-revoke.handler";
import { IApiKeyRepository } from "@src/modules/api-key/domain/api-key.repository";
import { ApiKeyDataAccessObject } from "@src/modules/api-key/infra/api-key.data-access-object";
import { ApiKeyRepository } from "@src/modules/api-key/infra/api-key.repository";

@Module({
  imports: [DatabaseModule, CqrsModule],
  controllers: [ApiKeyAdminController, ApiKeyBackofficeController],
  providers: [
    ApiKeyAdminCreateHandler,
    ApiKeyAdminListHandler,
    ApiKeyAdminRevokeHandler,
    ApiKeyBackofficeCreateHandler,
    ApiKeyBackofficeListHandler,
    ApiKeyBackofficeRevokeHandler,
    ApiKeyDataAccessObject,
    { provide: IApiKeyRepository, useClass: ApiKeyRepository },
  ],
  exports: [IApiKeyRepository, ApiKeyDataAccessObject],
})
export class ApiKeyModule {}
