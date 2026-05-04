import { BaseEvent } from "@src/shared/events/base.event";
import { Id } from "@src/shared/value-objects/id.value-object";

export class MembershipDeactivatedEvent extends BaseEvent {
  public constructor(public readonly membershipId: Id) {
    super(membershipId);
  }
}
