import { Module } from "@nestjs/common";
import { DatabaseModule } from "@src/infra/database/database.module";
import { CommissionLedgerService } from "@src/modules/commission/commission-ledger.service";
import { PayoutPreviewController } from "@src/modules/commission/payout-preview.controller";

@Module({
  imports: [DatabaseModule],
  controllers: [PayoutPreviewController],
  providers: [CommissionLedgerService],
  exports: [CommissionLedgerService],
})
export class CommissionModule {}
