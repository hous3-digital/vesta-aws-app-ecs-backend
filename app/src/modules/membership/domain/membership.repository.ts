import { Id } from "@src/shared/value-objects/id.value-object";
import { Membership } from "@src/modules/membership/domain/membership.entity";

export abstract class IMembershipRepository {
  abstract findByUserIdOrThrow(userId: Id): Promise<Membership>;
  abstract findByIdOrThrow(id: Id): Promise<Membership>;
  abstract saveOrThrow(membership: Membership): Promise<Membership>;
}
