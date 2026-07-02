import { Injectable } from "@nestjs/common";
import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { CredentialListQuery } from "@src/modules/backoffice/credentials/application/queries/credential-list.query";
import { CredentialsBackofficeDao } from "@src/modules/backoffice/credentials/infra/credentials-backoffice.dao";
import {
  clampLimit,
  decodeCursor,
  encodeCursor,
} from "@src/modules/backoffice/shared/cursor-pagination.util";

export interface CredentialListItem {
  id: string;
  vcHash: string;
  status: string;
  kycLevel: string;
  subjectDid: string;
  issuedAt: string;
  expiresAt: string | null;
}

export interface CredentialListResult {
  items: CredentialListItem[];
  nextCursor: string | null;
}

@Injectable()
@QueryHandler(CredentialListQuery)
export class CredentialListHandler implements IQueryHandler<CredentialListQuery, CredentialListResult> {
  public constructor(private readonly dao: CredentialsBackofficeDao) {}

  public async execute(query: CredentialListQuery): Promise<CredentialListResult> {
    const limit = clampLimit(query.limit);
    const cursor = decodeCursor(query.cursor);

    const records = await this.dao.list({
      issuerId: query.issuerId,
      status: query.status,
      limit,
      cursorTs: cursor?.ts,
      cursorId: cursor?.id,
    });

    const hasMore = records.length > limit;
    const page = hasMore ? records.slice(0, limit) : records;

    const nextCursor = hasMore
      ? encodeCursor({ ts: page[page.length - 1].createdAt.toISOString(), id: page[page.length - 1].id })
      : null;

    return {
      items: page.map((r) => ({
        id: r.id,
        vcHash: r.vcHash,
        status: r.status,
        kycLevel: r.kycLevel,
        subjectDid: r.subjectDid,
        issuedAt: r.createdAt.toISOString(),
        expiresAt: r.expiresAt?.toISOString() ?? null,
      })),
      nextCursor,
    };
  }
}
