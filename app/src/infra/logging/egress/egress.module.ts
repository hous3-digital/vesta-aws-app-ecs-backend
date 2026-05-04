import { HttpModule as AxiosModule, HttpModuleAsyncOptions } from "@nestjs/axios";
import { DynamicModule, Module } from "@nestjs/common";
import { DatabaseModule } from "@src/infra/database/database.module";
import { EgressLogger } from "@src/infra/logging/egress/infra/egress.logger";
import { EgressService } from "@src/infra/logging/egress/infra/egress.service";

@Module({})
export class EgressModule {
  public static registerAsync(options: HttpModuleAsyncOptions): DynamicModule {
    return {
      module: EgressModule,
      imports: [DatabaseModule, AxiosModule.registerAsync(options)],
      providers: [EgressLogger, EgressService],
      exports: [EgressService],
    };
  }
}
