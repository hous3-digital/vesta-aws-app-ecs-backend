import { Injectable, NotFoundException } from "@nestjs/common";
import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { IIssuerRepository } from "@src/modules/issuer/domain/issuer.repository";
import { BackofficeProfileQuery } from "@src/modules/backoffice/profile/application/queries/backoffice-profile.query";

export interface BackofficeProfileResult {
  issuerId: string;
  name: string;
}

@Injectable()
@QueryHandler(BackofficeProfileQuery)
export class BackofficeProfileHandler implements IQueryHandler<BackofficeProfileQuery, BackofficeProfileResult> {
  public constructor(private readonly issuerRepository: IIssuerRepository) {}

  public async execute(query: BackofficeProfileQuery): Promise<BackofficeProfileResult> {
    const issuer = await this.issuerRepository.findByExternalId(query.issuerId);
    if (!issuer) throw new NotFoundException("Issuer not found");

    return {
      issuerId: issuer.externalId,
      name: issuer.name,
    };
  }
}
