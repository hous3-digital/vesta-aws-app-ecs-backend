import { Injectable } from "@nestjs/common";
import {
  IStoragePort,
  StorageDownloadInput,
  StorageDownloadOutput,
  StorageUploadInput,
} from "@src/infra/gateways/ports/storage/storage.port";
import { AwsStorageService } from "@src/infra/gateways/providers/aws/storage/aws-storage.service";
import {
  AwsStorageDownloadInput,
  AwsStorageUploadInput,
} from "@src/infra/gateways/providers/aws/storage/aws-storage.type";

@Injectable()
export class AwsStorageAdapter implements IStoragePort {
  public constructor(private readonly awsStorageService: AwsStorageService) {}

  public async upload(input: StorageUploadInput): Promise<void> {
    const uploadInput: AwsStorageUploadInput = {
      key: input.file.id.value,
      contentType: input.file.contentType,
      buffer: input.buffer,
      path: input.file.path.value,
      bucket: input.file.bucket,
    };

    await this.awsStorageService.upload(uploadInput);
  }

  public async download(input: StorageDownloadInput): Promise<StorageDownloadOutput> {
    const downloadInput: AwsStorageDownloadInput = {
      key: input.file.id.value,
      path: input.file.path.value,
      bucket: input.file.bucket,
    };

    const downloaded = await this.awsStorageService.download(downloadInput);

    return {
      buffer: downloaded.buffer,
    };
  }
}
