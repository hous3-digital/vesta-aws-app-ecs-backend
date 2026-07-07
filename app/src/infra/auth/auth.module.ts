import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { DatabaseModule } from "@src/infra/database/database.module";
import { ApiKeyGuard } from "@src/infra/auth/api-key.guard";
import { ApiKeyService } from "@src/infra/auth/api-key.service";
import { AdminSecretGuard } from "@src/infra/auth/admin-secret.guard";
import { AdminController } from "@src/infra/auth/admin.controller";
import { AdminIssuersController } from "@src/infra/auth/admin-issuers.controller";
import { BackofficeAuthController } from "@src/infra/auth/backoffice-auth.controller";
import { BackofficeAuthGuard } from "@src/infra/auth/backoffice-auth.guard";
import { BackofficeAuthService } from "@src/infra/auth/backoffice-auth.service";

@Global()
@Module({
  imports: [DatabaseModule, JwtModule.register({})],
  controllers: [AdminController, AdminIssuersController, BackofficeAuthController],
  providers: [ApiKeyService, ApiKeyGuard, AdminSecretGuard, BackofficeAuthGuard, BackofficeAuthService],
  exports: [ApiKeyService, ApiKeyGuard, BackofficeAuthGuard, BackofficeAuthService],
})
export class AuthModule {}
