import { Global, Module } from "@nestjs/common";
import { DatabaseModule } from "@src/infra/database/database.module";
import { ApiKeyGuard } from "@src/infra/auth/api-key.guard";
import { ApiKeyService } from "@src/infra/auth/api-key.service";
import { AdminSecretGuard } from "@src/infra/auth/admin-secret.guard";
import { AdminController } from "@src/infra/auth/admin.controller";

@Global()
@Module({
  imports: [DatabaseModule],
  controllers: [AdminController],
  providers: [ApiKeyService, ApiKeyGuard, AdminSecretGuard],
  exports: [ApiKeyService, ApiKeyGuard],
})
export class AuthModule {}
