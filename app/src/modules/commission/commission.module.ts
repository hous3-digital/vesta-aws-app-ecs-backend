import { Module } from "@nestjs/common";
import { DatabaseModule } from "@src/infra/database/database.module";
import { CommissionLedgerService } from "@src/modules/commission/commission-ledger.service";
import { EnvModule } from "@src/infra/env/env.module";
import { PayoutBackofficeController } from "@src/modules/commission/payout-backoffice.controller";
import { PayoutProcessorService } from "@src/modules/commission/payout-processor.service";
import { PayoutRequestService } from "@src/modules/commission/payout-request.service";
import { PayoutSettlementGateway } from "@src/modules/commission/payout-settlement.gateway";
import { SorobanPayoutSettlementGateway } from "@src/modules/commission/soroban-payout-settlement.gateway";

@Module({
  imports: [DatabaseModule, EnvModule],
  controllers: [PayoutBackofficeController],
  providers: [
    CommissionLedgerService,
    PayoutProcessorService,
    PayoutRequestService,
    { provide: PayoutSettlementGateway, useClass: SorobanPayoutSettlementGateway },
  ],
  exports: [CommissionLedgerService, PayoutRequestService],
})
export class CommissionModule {}
