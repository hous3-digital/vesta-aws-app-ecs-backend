import { registerDecorator, ValidationOptions } from "class-validator";

function IsFutureDate(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: "isFutureDate",
      target: object.constructor,
      propertyName: propertyName,
      options: {
        message: "$property must be a future date",
        ...validationOptions,
      },
      validator: {
        validate(value: Date): boolean {
          return value.getTime() > new Date().getTime();
        },
      },
    });
  };
}

export { IsFutureDate };
