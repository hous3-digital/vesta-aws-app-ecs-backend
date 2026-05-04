import { BaseEvent } from "@src/shared/events/base.event";
import { Id } from "@src/shared/value-objects/id.value-object";

export class UserCreatedEvent extends BaseEvent {
  public constructor(id: Id) {
    super(id);
  }
}
