export const swaggerFileSchema = {
  schema: {
    type: "object",
    required: ["file"],
    properties: {
      file: {
        type: "string",
        format: "binary",
        description: "Avatar image file",
      },
    },
  },
};
