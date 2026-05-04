import { Provider } from "@nestjs/common";
import { AwsSesAdapter } from "@src/infra/gateways/providers/aws/ses/aws-ses.adapter";

export const EmailFactory = Symbol("EmailFactory");

export const EmailFactoryProvider: Provider = {
  provide: EmailFactory,
  useClass: AwsSesAdapter, // INFO: change to your email provider service
};
