import { UnprocessableEntityException } from "@nestjs/common";

export class Name {
  private _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  public get value(): string {
    return this._value;
  }

  public static create(value: string): Name {
    this.validate(value);
    return new Name(value.trim());
  }

  public static restore(value: string): Name {
    return new Name(value);
  }

  private static validate(value: string): void {
    if (!this.hasOnlyLettersAndSpaces(value)) {
      throw new UnprocessableEntityException("Name must contain only letters and spaces");
    }

    if (!this.isFullName(value)) {
      throw new UnprocessableEntityException("Name must be a full name");
    }
  }

  private static hasOnlyLettersAndSpaces(value: string): boolean {
    const regex = /^[a-zA-ZÀ-ÿ\s]+$/;
    return regex.test(value);
  }

  private static isFullName(value: string): boolean {
    const words = value
      .trim()
      .split(/\s+/)
      .filter((word) => word.length >= 2);

    return words.length >= 2;
  }

  public getFirstName(): string {
    return this._value.split(" ")[0];
  }

  public getLastName(): string {
    const nameParts = this._value.split(" ");
    return nameParts.slice(1).join(" ");
  }
}
