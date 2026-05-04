import { BaseEvent } from "@src/shared/events/base.event";
import { Id } from "@src/shared/value-objects/id.value-object";

export class RoleActivatedEvent extends BaseEvent {
  public constructor(public readonly roleId: Id) {
    super(roleId);
  }
}
