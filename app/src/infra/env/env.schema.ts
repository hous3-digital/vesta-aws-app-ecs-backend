import { z } from "zod";

const envConfig = (config: Record<string, unknown>) => {
  const result = envSchema.parse(config);
  return result;
};

const envSchema = z.object({
  NODE_ENV: z.enum(["local", "test", "development", "production"]),

  PORT: z.string().transform((val) => parseInt(val, 10)),

  DATABASE_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(1, "JWT_ACCESS_SECRET is required"),

  VERIFF_BASE_URL: z.string().url(),
  VERIFF_API_KEY: z.string().min(1, "VERIFF_API_KEY is required"),
  VERIFF_SECRET_KEY: z.string().min(1, "VERIFF_SECRET_KEY is required"),

  AWS_S3_PUBLIC_BUCKET: z.string().min(1, "AWS_S3_PUBLIC_BUCKET is required"),
  AWS_S3_PRIVATE_BUCKET: z.string().min(1, "AWS_S3_PRIVATE_BUCKET is required"),
  AWS_S3_PUBLIC_BASE_URL: z.string().url().min(1, "AWS_S3_PUBLIC_BASE_URL is required"),
  AWS_REGION: z.string().min(1, "AWS_REGION is required"),
  AWS_IAM_ACCESS_KEY_ID: z.string().min(1, "AWS_IAM_ACCESS_KEY_ID is required"),
  AWS_IAM_SECRET_ACCESS_KEY: z.string().min(1, "AWS_IAM_SECRET_ACCESS_KEY is required"),
});

const isLocal = process.env.NODE_ENV === "local";
export const validate = isLocal ? { validate: envConfig } : undefined;
