import { BaseEvent } from "@src/shared/events/base.event";
import { Id } from "@src/shared/value-objects/id.value-object";

export class FileApprovedEvent extends BaseEvent {
  public constructor(public readonly fileId: Id) {
    super(fileId);
  }
}
