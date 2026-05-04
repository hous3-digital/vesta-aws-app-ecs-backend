import { Module } from "@nestjs/common";
import { DatabaseModule } from "@src/infra/database/database.module";
import { IngressLogger } from "@src/infra/logging/ingress/infra/ingress.logger";

@Module({
  imports: [DatabaseModule],
  providers: [IngressLogger],
  exports: [IngressLogger],
})
export class IngressModule {}
