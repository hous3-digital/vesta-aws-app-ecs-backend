import { Provider } from "@nestjs/common";
import { VeriffKycAdapter } from "@src/infra/gateways/providers/veriff/kyc/veriff-kyc.adapter";

export const KycFactory = Symbol("KycFactory");

export const KycFactoryProvider: Provider = {
  provide: KycFactory,
  useClass: VeriffKycAdapter, // INFO: change to your kyc provider service
};
