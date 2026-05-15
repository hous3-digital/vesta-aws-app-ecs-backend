import { Module } from "@nestjs/common";
import { ChallengePublicController } from "@src/modules/challenge/api/public/challenge-public.controller";
import { ChallengeService } from "@src/modules/challenge/challenge.service";

@Module({
  controllers: [ChallengePublicController],
  providers: [ChallengeService],
  exports: [ChallengeService],
})
export class ChallengeModule {}
