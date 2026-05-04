import { applyDecorators, Type } from "@nestjs/common";
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from "@nestjs/swagger";
import { ApiDataResponse } from "@src/utils/types/api-data.output";

export const ApiOkResponseData = <TModel extends Type<any>>(model: TModel, isArray = false) => {
  return applyDecorators(
    ApiExtraModels(ApiDataResponse, model),
    ApiOkResponse({
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
