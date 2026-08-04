import { Verifier } from "@src/modules/backoffice/verifiers/domain/verifier.entity";

export abstract class IVerifierRepository {
  abstract findById(id: string): Promise<Verifier | null>;
  abstract findManyByIds(ids: string[]): Promise<Map<string, Verifier>>;
  abstract listAll(): Promise<Verifier[]>;
  abstract saveOrThrow(verifier: Verifier): Promise<Verifier>;
  abstract updateOrThrow(verifier: Verifier): Promise<Verifier>;
}
