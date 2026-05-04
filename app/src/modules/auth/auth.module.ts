import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { JwtModule } from "@src/infra/cipher/jwt/jwt.module";
import { DatabaseModule } from "@src/infra/database/database.module";
import { AuthPublicController } from "@src/modules/auth/api/public/auth-public.controller";
import { AuthPublicAuthenticateCreateHandler } from "@src/modules/auth/application/public/handlers/auth-public-authenticate-create.handler";
import { AuthPublicAuthorizeCreateHandler } from "@src/modules/auth/application/public/handlers/auth-public-authorize-create.handler";
import { IAuthService } from "@src/modules/auth/domain/auth.service";
import { AuthService } from "@src/modules/auth/infra/auth.service";
import { MembershipModule } from "@src/modules/membership/membership.module";

@Module({
  imports: [DatabaseModule, CqrsModule, JwtModule, MembershipModule],
  controllers: [AuthPublicController],
  providers: [
    AuthPublicAuthenticateCreateHandler,
    AuthPublicAuthorizeCreateHandler,
    AuthService,
    { provide: IAuthService, useClass: AuthService },
  ],
})
export class AuthModule {}
