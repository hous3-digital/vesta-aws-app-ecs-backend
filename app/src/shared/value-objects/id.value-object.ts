import { typeid } from "typeid-js";

export class Id {
  private _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  public get value() {
    return this._value;
  }

  public static create(preffix: string): Id {
    return new Id(typeid(preffix).toString());
  }

  public static restore(value: string): Id {
    return new Id(value);
  }

  public equals(id: Id) {
    return this._value === id._value;
  }
}
