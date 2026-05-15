import { Attestation } from "@src/modules/proof/domain/attestation.entity";

export abstract class IAttestationRepository {
  abstract saveOrThrow(attestation: Attestation): Promise<Attestation>;
  abstract findByVcHash(vcHash: string): Promise<Attestation[]>;
}
