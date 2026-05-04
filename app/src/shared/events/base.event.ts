import { Id } from "@src/shared/value-objects/id.value-object";

export class BaseEvent {
  public constructor(public readonly id: Id) {}
}
