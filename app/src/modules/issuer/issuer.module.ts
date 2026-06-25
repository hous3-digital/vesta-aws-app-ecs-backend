import { Module } from "@nestjs/common";
import { DatabaseModule } from "@src/infra/database/database.module";
import { IIssuerRepository } from "@src/modules/issuer/domain/issuer.repository";
import { IssuerRepository } from "@src/modules/issuer/infra/issuer.repository";

@Module({
  imports: [DatabaseModule],
  providers: [{ provide: IIssuerRepository, useClass: IssuerRepository }],
  exports: [IIssuerRepository],
})
export class IssuerModule {}
