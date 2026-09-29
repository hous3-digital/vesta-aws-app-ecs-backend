import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validate } from "@src/infra/env/env.schema";
import { EnvService } from "@src/infra/env/env.service";

@Global()
@Module({
  // ENV_FILE selects another dotenv file (e.g. .env.local) without touching .env
  imports: [ConfigModule.forRoot({ ...validate, envFilePath: process.env.ENV_FILE ?? ".env" })],
  providers: [EnvService],
  exports: [EnvService],
})
export class EnvModule {}
