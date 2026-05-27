import { Module } from "@nestjs/common";
import { VcService } from "@src/modules/vc/vc.service";

@Module({
  providers: [VcService],
  exports: [VcService],
})
export class VcModule {}
