import { SESv2Client } from "@aws-sdk/client-sesv2";
import { Module } from "@nestjs/common";
import { EnvService } from "@src/infra/env/env.service";
import { AwsSesService } from "@src/infra/gateways/providers/aws/ses/aws-ses.service";

@Module({
  providers: [
    {
      provide: SESv2Client,
      inject: [EnvService],
      useFactory: (envService: EnvService) =>
        new SESv2Client({
          region: envService.AWS_REGION,
          credentials: {
            accessKeyId: envService.AWS_IAM_ACCESS_KEY_ID,
            secretAccessKey: envService.AWS_IAM_SECRET_ACCESS_KEY,
          },
        }),
    },
    AwsSesService,
  ],
  exports: [AwsSesService],
})
export class AwsSesModule {}
