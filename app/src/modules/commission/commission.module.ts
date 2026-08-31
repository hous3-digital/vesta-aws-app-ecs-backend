import { Module } from "@nestjs/common";
import { DatabaseModule } from "@src/infra/database/database.module";
import { CommissionLedgerService } from "@src/modules/commission/commission-ledger.service";
import { EnvModule } from "@src/infra/env/env.module";
import { PayoutBackofficeController } from "@src/modules/commission/payout-backoffice.controller";
import { PayoutProcessorService } from "@src/modules/commission/payout-processor.service";
import { PayoutRequestService } from "@src/modules/commission/payout-request.service";
import { PayoutSettlementGateway } from "@src/modules/commission/payout-settlement.gateway";
import { SorobanPayoutSettlementGateway } from "@src/modules/commission/soroban-payout-settlement.gateway";
import { WalletModule } from "@src/modules/wallet/wallet.module";
import { CommissionRegistrationProcessorService } from "@src/modules/commission/commission-registration-processor.service";
import { CommissionRegistrationGateway } from "@src/modules/commission/commission-registration.gateway";
import { SorobanCommissionRegistrationGateway } from "@src/modules/commission/soroban-commission-registration.gateway";

@Module({
  imports: [DatabaseModule, EnvModule, WalletModule],
  controllers: [PayoutBackofficeController],
  providers: [
    CommissionLedgerService,
    CommissionRegistrationProcessorService,
    PayoutProcessorService,
    PayoutRequestService,
    { provide: PayoutSettlementGateway, useClass: SorobanPayoutSettlementGateway },
    { provide: CommissionRegistrationGateway, useClass: SorobanCommissionRegistrationGateway },
  ],
  exports: [CommissionLedgerService, PayoutRequestService],
})
export class CommissionModule {}
