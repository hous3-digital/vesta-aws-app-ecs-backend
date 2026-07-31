import { Module } from "@nestjs/common";
import { EnvModule } from "@src/infra/env/env.module";
import { IssuerModule } from "@src/modules/issuer/issuer.module";
import { StellarModule } from "@src/modules/stellar/stellar.module";
import { WalletService } from "@src/modules/wallet/wallet.service";

@Module({
  imports: [EnvModule, IssuerModule, StellarModule],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
