import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { DatabaseModule } from "@src/infra/database/database.module";
import { UserBackofficeController } from "@src/modules/user/api/backoffice/user-backoffice.controller";
import { UserPublicController } from "@src/modules/user/api/public/user-public.controller";
import { UserBackofficeDeactivateHandler } from "@src/modules/user/application/backoffice/handlers/user-backoffice-deactivate.handler";
import { UserPublicCreateHandler } from "@src/modules/user/application/public/handlers/user-public-create.handler";

@Module({
  imports: [DatabaseModule, CqrsModule],
  controllers: [UserPublicController, UserBackofficeController],
  providers: [UserPublicCreateHandler, UserBackofficeDeactivateHandler],
})
export class UserModule {}
