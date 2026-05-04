import { Module } from "@nestjs/common";
import { EmailFactoryProvider } from "@src/infra/gateways/ports/email/email.factory";
import { AwsSesModule } from "@src/infra/gateways/providers/aws/ses/aws-ses.module";

@Module({
  imports: [AwsSesModule], // INFO: import all email providers here
  providers: [EmailFactoryProvider],
  exports: [EmailFactoryProvider],
})
export class EmailPortModule {}
