import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Injectable, Logger } from "@nestjs/common";
import {
  AwsStorageDownloadInput,
  AwsStorageDownloadOutput,
  AwsStorageUploadInput,
} from "@src/infra/gateways/providers/aws/storage/aws-storage.type";
import { handleHttpError } from "@src/utils/helpers/http-error.helper";

@Injectable()
export class AwsStorageService {
  private readonly logger = new Logger(AwsStorageService.name);

  public constructor(private readonly storageClient: S3Client) {}

  public async upload(input: AwsStorageUploadInput): Promise<boolean> {
    try {
      const command = new PutObjectCommand({
        Bucket: input.bucket,
        Key: `${input.path}/${input.key}`,
        ContentType: input.contentType,
        Body: input.buffer,
      });

      await this.storageClient.send(command);

      return true;
    } catch (error) {
      this.logger.error(error.message, error.stack);
      handleHttpError(error);
    }
  }

  public async download(input: AwsStorageDownloadInput): Promise<AwsStorageDownloadOutput> {
    try {
      const command = new GetObjectCommand({
        Bucket: input.bucket,
        Key: `${input.path}/${input.key}`,
      });

      const response = await this.storageClient.send(command);

      const arrayBuffer = await response.Body?.transformToByteArray();
      const buffer = Buffer.from(arrayBuffer || []);

      return {
        contentType: response.ContentType as string,
        buffer: buffer,
      };
    } catch (error) {
      this.logger.error(error.message, error.stack);
      handleHttpError(error);
    }
  }
}
