import { Module } from "@nestjs/common";
import { ZkService } from "@src/modules/zk/zk.service";

@Module({
  providers: [ZkService],
  exports: [ZkService],
})
export class ZkModule {}
