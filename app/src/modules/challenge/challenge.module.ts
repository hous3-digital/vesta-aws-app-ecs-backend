import { Module } from "@nestjs/common";
import { ChallengePublicController } from "@src/modules/challenge/api/public/challenge-public.controller";
import { ChallengeService } from "@src/modules/challenge/challenge.service";
import { EnvModule } from "@src/infra/env/env.module";
import { DatabaseModule } from "@src/infra/database/database.module";
import { CredentialModule } from "@src/modules/credential/credential.module";
import { PasskeyAuthService } from "@src/modules/challenge/passkey-auth.service";
import { WalletModule } from "@src/modules/wallet/wallet.module";
import { VcModule } from "@src/modules/vc/vc.module";
import { CredentialRecoveryController } from "@src/modules/challenge/api/public/credential-recovery.controller";
import { CredentialRecoveryService } from "@src/modules/challenge/credential-recovery.service";

@Module({
  imports: [CredentialModule, DatabaseModule, EnvModule, WalletModule, VcModule],
  controllers: [ChallengePublicController, CredentialRecoveryController],
  providers: [ChallengeService, PasskeyAuthService, CredentialRecoveryService],
  exports: [ChallengeService],
})
export class ChallengeModule {}
