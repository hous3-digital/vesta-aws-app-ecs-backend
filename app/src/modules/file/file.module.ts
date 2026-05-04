import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { DatabaseModule } from "@src/infra/database/database.module";
import { EnvModule } from "@src/infra/env/env.module";
import { StoragePortModule } from "@src/infra/gateways/ports/storage/storage.module";
import { IAuthService } from "@src/modules/auth/domain/auth.service";
import { AuthService } from "@src/modules/auth/infra/auth.service";
import { FilePublicController } from "@src/modules/file/api/public/file-public.controller";
import { FilePublicDownloadHandler } from "@src/modules/file/application/public/handlers/file-public-download.handler";
import { FilePublicUserAvatarUploadHandler } from "@src/modules/file/application/public/handlers/file-public-user-avatar-upload.handler";
import { IFileRepository } from "@src/modules/file/domain/file.repository";
import { FileRepository } from "@src/modules/file/infra/file.repository";

const controllers = [FilePublicController];

const publicProviders = [FilePublicUserAvatarUploadHandler, FilePublicDownloadHandler];

const infraProviders = [
  { provide: IAuthService, useClass: AuthService },
  { provide: IFileRepository, useClass: FileRepository },
];

const providers = [...publicProviders, ...infraProviders];

@Module({
  imports: [DatabaseModule, CqrsModule, EnvModule, StoragePortModule],
  controllers: controllers,
  providers: providers,
})
export class FileModule {}
