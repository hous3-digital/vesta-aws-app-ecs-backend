import { Module } from "@nestjs/common";
import { ZkService } from "@src/modules/zk/application/services/zk.service";

@Module({
  providers: [ZkService],
  exports: [ZkService],
})
export class ZkModule {}
