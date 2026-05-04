import { S3Client } from "@aws-sdk/client-s3";
import { Module } from "@nestjs/common";
import { EnvService } from "@src/infra/env/env.service";
import { AwsStorageService } from "@src/infra/gateways/providers/aws/storage/aws-storage.service";

@Module({
  providers: [
    {
      provide: S3Client,
      inject: [EnvService],
      useFactory: (envService: EnvService) =>
        new S3Client({
          region: envService.AWS_REGION,
          credentials: {
            accessKeyId: envService.AWS_IAM_ACCESS_KEY_ID,
            secretAccessKey: envService.AWS_IAM_SECRET_ACCESS_KEY,
          },
        }),
    },
    AwsStorageService,
  ],
  exports: [AwsStorageService],
})
export class AwsStorageModule {}
