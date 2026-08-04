import { Injectable } from "@nestjs/common";
import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { VerifierListQuery } from "@src/modules/backoffice/verifiers/application/queries/verifier-list.query";
import { IVerifierRepository } from "@src/modules/backoffice/verifiers/domain/verifier.repository";

export interface VerifierListItem {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
@QueryHandler(VerifierListQuery)
export class VerifierListHandler implements IQueryHandler<VerifierListQuery, VerifierListItem[]> {
  public constructor(private readonly verifierRepository: IVerifierRepository) {}

  public async execute(): Promise<VerifierListItem[]> {
    const verifiers = await this.verifierRepository.listAll();
    return verifiers.map((v) => ({
      id: v.id,
      name: v.name,
      status: v.status,
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
    }));
  }
}
