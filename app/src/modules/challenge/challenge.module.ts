import { Module } from "@nestjs/common";
import { ChallengePublicController } from "@src/modules/challenge/api/public/challenge-public.controller";
import { ChallengeService } from "@src/modules/challenge/challenge.service";
import { EnvModule } from "@src/infra/env/env.module";
import { DatabaseModule } from "@src/infra/database/database.module";
import { CredentialModule } from "@src/modules/credential/credential.module";
import { PasskeyAuthService } from "@src/modules/challenge/passkey-auth.service";
import { WalletModule } from "@src/modules/wallet/wallet.module";

@Module({
  imports: [CredentialModule, DatabaseModule, EnvModule, WalletModule],
  controllers: [ChallengePublicController],
  providers: [ChallengeService, PasskeyAuthService],
  exports: [ChallengeService],
})
export class ChallengeModule {}
