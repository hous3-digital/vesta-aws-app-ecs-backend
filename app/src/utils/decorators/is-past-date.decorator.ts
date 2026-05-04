import { registerDecorator, ValidationOptions } from "class-validator";

function IsPastDate(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: "isPastDate",
      target: object.constructor,
      propertyName: propertyName,
      options: {
        message: "$property must not be a future date",
        ...validationOptions,
      },
      validator: {
        validate(value: Date): boolean {
          return value.getTime() <= new Date().getTime();
        },
      },
    });
  };
}

export { IsPastDate };
