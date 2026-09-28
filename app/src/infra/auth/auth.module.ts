import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { DatabaseModule } from "@src/infra/database/database.module";
import { ApiKeyGuard } from "@src/infra/auth/api-key.guard";
import { AdminSecretGuard } from "@src/infra/auth/admin-secret.guard";
import { AdminIssuersController } from "@src/infra/auth/admin-issuers.controller";
import { BackofficeAuthController } from "@src/infra/auth/backoffice-auth.controller";
import { BackofficeAuthGuard } from "@src/infra/auth/backoffice-auth.guard";
import { BackofficeAuthService } from "@src/infra/auth/backoffice-auth.service";
import { WalletModule } from "@src/modules/wallet/wallet.module";
import { IssuerModule } from "@src/modules/issuer/issuer.module";
import { ApiKeyModule } from "@src/modules/api-key/api-key.module";

@Global()
@Module({
  imports: [DatabaseModule, WalletModule, IssuerModule, ApiKeyModule, JwtModule.register({})],
  controllers: [AdminIssuersController, BackofficeAuthController],
  providers: [ApiKeyGuard, AdminSecretGuard, BackofficeAuthGuard, BackofficeAuthService],
  exports: [ApiKeyGuard, BackofficeAuthGuard, BackofficeAuthService],
})
export class AuthModule {}
