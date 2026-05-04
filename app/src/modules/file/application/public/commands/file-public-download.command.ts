import { Id } from "@src/shared/value-objects/id.value-object";

export class FilePublicDownloadCommand {
  public constructor(public readonly fileId: Id) {}
}
