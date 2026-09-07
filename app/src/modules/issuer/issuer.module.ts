import { Module } from "@nestjs/common";
import { DatabaseModule } from "@src/infra/database/database.module";
import { IIssuerRepository } from "@src/modules/issuer/domain/issuer.repository";
import { IssuerRepository } from "@src/modules/issuer/infra/issuer.repository";
import { IssuerRegistryGateway } from "@src/modules/issuer/issuer-registry.gateway";
import { IssuerRegistryService } from "@src/modules/issuer/issuer-registry.service";
import { SorobanIssuerRegistryGateway } from "@src/modules/issuer/soroban-issuer-registry.gateway";

@Module({
  imports: [DatabaseModule],
  providers: [
    { provide: IIssuerRepository, useClass: IssuerRepository },
    { provide: IssuerRegistryGateway, useClass: SorobanIssuerRegistryGateway },
    IssuerRegistryService,
  ],
  exports: [IIssuerRepository, IssuerRegistryService, IssuerRegistryGateway],
})
export class IssuerModule {}
