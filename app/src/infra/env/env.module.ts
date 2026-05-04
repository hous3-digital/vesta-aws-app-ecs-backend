import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validate } from "@src/infra/env/env.schema";
import { EnvService } from "@src/infra/env/env.service";

@Global()
@Module({
  imports: [ConfigModule.forRoot(validate)],
  providers: [EnvService],
  exports: [EnvService],
})
export class EnvModule {}
