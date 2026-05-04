import { Global, Module } from "@nestjs/common";
import { JwtModule as BaseJwtModule } from "@nestjs/jwt";
import { EnvService } from "@src/infra/env/env.service";

@Global()
@Module({
  imports: [
    BaseJwtModule.registerAsync({
      inject: [EnvService],
      useFactory: async (envService: EnvService) => ({
        secret: envService.JWT_ACCESS_SECRET,
      }),
    }),
  ],
  exports: [BaseJwtModule],
})
export class JwtModule {}
