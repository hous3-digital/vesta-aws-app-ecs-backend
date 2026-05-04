import { Provider } from "@nestjs/common";
import { AwsStorageAdapter } from "@src/infra/gateways/providers/aws/storage/aws-storage.adapter";

export const StorageFactory = Symbol("StorageFactory");

export const StorageFactoryProvider: Provider = {
  provide: StorageFactory,
  useClass: AwsStorageAdapter, // INFO: change to your storage provider service
};
