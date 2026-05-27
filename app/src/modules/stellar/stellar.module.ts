import { Module } from "@nestjs/common";
import { StellarService } from "@src/modules/stellar/stellar.service";

@Module({
  providers: [StellarService],
  exports: [StellarService],
})
export class StellarModule {}
