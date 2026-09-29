import { Injectable } from "@nestjs/common";
import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { ApiKeyAdminListQuery } from "@src/modules/api-key/application/admin/queries/api-key-admin-list.query";
import { ApiKeyDataAccessObject } from "@src/modules/api-key/infra/api-key.data-access-object";

export type ApiKeyAdminListResult = Awaited<ReturnType<ApiKeyDataAccessObject["listAll"]>>;

@Injectable()
@QueryHandler(ApiKeyAdminListQuery)
export class ApiKeyAdminListHandler implements IQueryHandler<ApiKeyAdminListQuery, ApiKeyAdminListResult> {
  public constructor(private readonly apiKeyDao: ApiKeyDataAccessObject) {}

  public async execute(): Promise<ApiKeyAdminListResult> {
    return this.apiKeyDao.listAll();
  }
}
