import { Module } from "@nestjs/common";
import { KycFactoryProvider } from "@src/infra/gateways/ports/kyc/kyc.factory";
import { VeriffKycModule } from "@src/infra/gateways/providers/veriff/kyc/veriff-kyc.module";

@Module({
  imports: [VeriffKycModule], // INFO: import all kyc providers here
  providers: [KycFactoryProvider],
  exports: [KycFactoryProvider],
})
export class KycPortModule {}
