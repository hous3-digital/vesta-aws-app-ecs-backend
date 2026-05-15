import { z } from "zod";

const envConfig = (config: Record<string, unknown>) => {
  const result = envSchema.parse(config);
  return result;
};

const envSchema = z.object({
  NODE_ENV: z.enum(["local", "test", "development", "production"]),

  PORT: z.string().transform((val) => parseInt(val, 10)),

  DATABASE_URL: z.string().url(),
});

const isLocal = process.env.NODE_ENV === "local";
export const validate = isLocal ? { validate: envConfig } : undefined;
