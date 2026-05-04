import { UnprocessableEntityException } from "@nestjs/common";
import { FileType } from "@src/modules/file/domain/file.entity";

export class FilePath {
  private readonly _value: string;

  public constructor(value: string) {
    this._value = value;
  }

  public get value(): string {
    return this._value;
  }

  public static create(value: FileType): FilePath {
    this.validate(value);
    const path = this.toPath(value);
    return new FilePath(path);
  }

  public static restore(value: string): FilePath {
    return new FilePath(value);
  }

  private static validate(value: FileType): void {
    if (this.isEmpty(value)) {
      throw new UnprocessableEntityException("FilePath cannot be empty");
    }

    if (!this.isKebabCase(value)) {
      throw new UnprocessableEntityException("FilePath must be in kebab-case");
    }

    if (!this.hasMultipleWords(value)) {
      throw new UnprocessableEntityException("FilePath must contain at least two words in PascalCase");
    }
  }

  private static isEmpty(value: FileType): boolean {
    return value.trim().length === 0;
  }

  private static isKebabCase(value: FileType): boolean {
    return /^[a-z]+(-[a-z]+)*$/.test(value);
  }

  private static hasMultipleWords(value: FileType): boolean {
    return value.includes("-");
  }

  public static toPath(value: FileType) {
    const fileTypePaths: { [K in FileType]: string } = {
      [FileType.UserAvatar]: "user/avatar",
      // TODO: add other file types
    };

    return fileTypePaths[value];
  }
}
