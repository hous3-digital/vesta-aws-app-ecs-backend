import { Injectable, NotFoundException } from "@nestjs/common";
import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { CredentialDetailQuery } from "@src/modules/backoffice/credentials/application/queries/credential-detail.query";
import { CredentialsBackofficeDao } from "@src/modules/backoffice/credentials/infra/credentials-backoffice.dao";
import { BackofficeContextService } from "@src/modules/backoffice/shared/backoffice-context.service";

export interface CredentialDetailResult {
  id: string;
  vcHash: string;
  status: string;
  kycLevel: string;
  subjectDid: string;
  issuerDid: string;
  sorobanTxHash: string | null;
  issuedAt: string;
  updatedAt: string;
  expiresAt: string | null;
}

@Injectable()
@QueryHandler(CredentialDetailQuery)
export class CredentialDetailHandler implements IQueryHandler<CredentialDetailQuery, CredentialDetailResult> {
  public constructor(
    private readonly dao: CredentialsBackofficeDao,
    private readonly context: BackofficeContextService,
  ) {}

  public async execute(query: CredentialDetailQuery): Promise<CredentialDetailResult> {
    const issuerId = this.context.getCurrentIssuerId();
    const record = await this.dao.findById(issuerId, query.id);
    if (!record) throw new NotFoundException(`Credencial nao encontrada: ${query.id}`);
    return {
      id: record.id,
      vcHash: record.vcHash,
      status: record.status,
      kycLevel: record.kycLevel,
      subjectDid: record.subjectDid,
      issuerDid: record.issuerDid,
      sorobanTxHash: record.sorobanTxHash,
      issuedAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      expiresAt: record.expiresAt?.toISOString() ?? null,
    };
  }
}
