import { UnprocessableEntityException } from "@nestjs/common";
import * as bcrypt from "bcrypt";

export class Password {
  private _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  public get value(): string {
    return this._value;
  }

  public static create(value: string): Password {
    this.validate(value);
    const hash = bcrypt.hashSync(value, 10);
    return new Password(hash);
  }

  public static restore(value: string): Password {
    return new Password(value);
  }

  private static validate(value: string): void {
    if (!this.hasMinLength(value)) {
      throw new UnprocessableEntityException("Password must have at least 8 characters");
    }
  }

  private static hasMinLength(value: string): boolean {
    return value.length >= 8;
  }

  public match(unsafe: string): boolean {
    return bcrypt.compareSync(unsafe, this._value);
  }
}
