import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { EnvService } from "@src/infra/env/env.service";
import { VeriffKycService } from "@src/infra/gateways/providers/veriff/kyc/veriff-kyc.service";
import { EgressModule } from "@src/infra/logging/egress/egress.module";

@Module({
  imports: [
    CqrsModule,
    EgressModule.registerAsync({
      inject: [EnvService],
      useFactory: async (envService: EnvService) => ({
        baseURL: envService.VERIFF_BASE_URL,
      }),
    }),
  ],
  providers: [VeriffKycService],
  exports: [VeriffKycService],
})
export class VeriffKycModule {}
