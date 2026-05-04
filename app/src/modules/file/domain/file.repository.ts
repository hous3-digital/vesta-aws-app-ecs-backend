import { File } from "@src/modules/file/domain/file.entity";
import { Id } from "@src/shared/value-objects/id.value-object";

export abstract class IFileRepository {
  abstract findByIdOrThrow(id: Id): Promise<File>;
  abstract saveOrThrow(file: File): Promise<File>;
  abstract updateOrThrow(file: File): Promise<File>;
}
