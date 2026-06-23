import { Module } from "@nestjs/common";
import { EnvModule } from "@src/infra/env/env.module";
import { IssuerModule } from "@src/modules/issuer/issuer.module";
import { WalletService } from "@src/modules/wallet/wallet.service";

@Module({
  imports: [EnvModule, IssuerModule],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
