import { applyDecorators, Type } from "@nestjs/common";
import { ApiCreatedResponse, ApiExtraModels, getSchemaPath } from "@nestjs/swagger";
import { ApiDataResponse } from "@src/utils/types/api-data.output";

export const ApiCreatedResponseData = <TModel extends Type<any>>(model: TModel, isArray = false) => {
  return applyDecorators(
    ApiExtraModels(ApiDataResponse, model),
    ApiCreatedResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiDataResponse) },
          {
            properties: {
              data: isArray
                ? {
                    type: "array",
                    items: { $ref: getSchemaPath(model) },
                  }
                : {
                    $ref: getSchemaPath(model),
                  },
            },
          },
        ],
      },
    }),
  );
};
