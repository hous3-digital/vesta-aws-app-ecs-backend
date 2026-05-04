import { Id } from "@src/shared/value-objects/id.value-object";

export class UserBackofficeDeactivateCommand {
  public constructor(public readonly userId: Id) {}
}
