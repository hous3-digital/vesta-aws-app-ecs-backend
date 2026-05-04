import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { DatabaseModule } from "@src/infra/database/database.module";
import { MembershipPublicController } from "@src/modules/membership/api/public/membership-public.controller";
import { MembershipPublicFindManyHandler } from "@src/modules/membership/application/public/handlers/membership-public-find-many.handler";

@Module({
  imports: [DatabaseModule, CqrsModule],
  controllers: [MembershipPublicController],
  providers: [MembershipPublicFindManyHandler],
})
export class MembershipModule {}
