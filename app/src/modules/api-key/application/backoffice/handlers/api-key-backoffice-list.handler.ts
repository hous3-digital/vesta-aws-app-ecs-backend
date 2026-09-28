import { Injectable } from "@nestjs/common";
import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { ApiKeyBackofficeListQuery } from "@src/modules/api-key/application/backoffice/queries/api-key-backoffice-list.query";
import { ApiKeyDataAccessObject } from "@src/modules/api-key/infra/api-key.data-access-object";

export type ApiKeyBackofficeListResult = Awaited<ReturnType<ApiKeyDataAccessObject["listByIssuer"]>>;

@Injectable()
@QueryHandler(ApiKeyBackofficeListQuery)
export class ApiKeyBackofficeListHandler implements IQueryHandler<
  ApiKeyBackofficeListQuery,
  ApiKeyBackofficeListResult
> {
  public constructor(private readonly apiKeyDao: ApiKeyDataAccessObject) {}

  public async execute(query: ApiKeyBackofficeListQuery): Promise<ApiKeyBackofficeListResult> {
    return this.apiKeyDao.listByIssuer(query.issuerId);
  }
}
