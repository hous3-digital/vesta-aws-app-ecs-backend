import { Module } from "@nestjs/common";
import { StorageFactoryProvider } from "@src/infra/gateways/ports/storage/storage.factory";
import { AwsStorageModule } from "@src/infra/gateways/providers/aws/storage/aws-storage.module";

@Module({
  imports: [AwsStorageModule], // INFO: import all storage providers here
  providers: [StorageFactoryProvider],
  exports: [StorageFactoryProvider],
})
export class StoragePortModule {}
