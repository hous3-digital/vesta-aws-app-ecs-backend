import { registerDecorator, ValidationOptions } from "class-validator";

function IsValidMoney(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: "isValidMoney",
      target: object.constructor,
      propertyName: propertyName,
      options: {
        message: "$property must have maximum 2 decimal places",
        ...validationOptions,
      },
      validator: {
        validate(value: number): boolean {
          return Number(value.toFixed(2)) === value;
        },
      },
    });
  };
}

export { IsValidMoney };
