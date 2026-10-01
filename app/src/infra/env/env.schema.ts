import { z } from "zod";

const envConfig = (config: Record<string, unknown>) => {
  const result = envSchema.parse(config);
  return result;
};

/**
 * Rules that depend on more than one variable. Declared before the object so the
 * text parser of scripts/env-diff.mjs keeps reading the field declarations only.
 */
function refineEnv(env: z.infer<typeof envObject>, ctx: z.RefinementCtx): void {
  if (env.NODE_ENV === "production" && !env.PRIVY_APP_SECRET) {
    ctx.addIssue({
      code: "custom",
      path: ["PRIVY_APP_SECRET"],
      message: "PRIVY_APP_SECRET is required when NODE_ENV=production",
    });
  }
  if (env.BACKOFFICE_JWT_EXPIRES_IN === "never" && env.NODE_ENV !== "local") {
    ctx.addIssue({
      code: "custom",
      path: ["BACKOFFICE_JWT_EXPIRES_IN"],
      message: "BACKOFFICE_JWT_EXPIRES_IN=never is allowed only when NODE_ENV=local",
    });
  }
  // One secret, one purpose: with equal values a leaked admin header forges backoffice sessions.
  if (env.BACKOFFICE_JWT_SECRET === env.ADMIN_SECRET) {
    ctx.addIssue({
      code: "custom",
      path: ["BACKOFFICE_JWT_SECRET"],
      message: "BACKOFFICE_JWT_SECRET must differ from ADMIN_SECRET",
    });
  }
}

const envObject = z.object({
  NODE_ENV: z.enum(["local", "test", "development", "production"]),

  PORT: z
    .string()
    .default("3000")
    .transform((val) => parseInt(val, 10)),

  DATABASE_URL: z.string().url(),

  STELLAR_RPC_URL: z.string().url().default("https://soroban-testnet.stellar.org"),
  STELLAR_HORIZON_URL: z.string().url().optional(),
  STELLAR_NETWORK: z.string().min(1).default("Test SDF Network ; September 2015"),
  VESTA_CONTRACT_ID: z.string().min(1).default("PLACEHOLDER"),
  STELLAR_ISSUER_REGISTRY_CONTRACT_ID: z.string().min(1).default("PLACEHOLDER"),
  VESTA_DEPLOYER_SECRET: z.string().optional().default(""),
  ZK_ARTIFACTS_DIR: z.string().min(1).default("./zk-artifacts"),
  ZK_MOCK_MODE: z
    .string()
    .transform((v) => v === "true")
    .default(true),

  CPF_HMAC_SECRET: z.string().min(32, "CPF_HMAC_SECRET must be at least 32 characters"),

  CORS_ALLOWED_ORIGINS: z.string().optional().default(""),

  REDIS_URL: z.string().optional(),

  ADMIN_SECRET: z.string().min(32, "ADMIN_SECRET must be at least 32 characters"),
  BACKOFFICE_JWT_SECRET: z.string().min(32, "BACKOFFICE_JWT_SECRET must be at least 32 characters"),
  BACKOFFICE_JWT_EXPIRES_IN: z
    .string()
    .regex(/^(\d+[smhd]?|never)$/, "BACKOFFICE_JWT_EXPIRES_IN must be a number with an optional s, m, h or d unit")
    .default("8h"),

  PRIVY_APP_ID: z.string().min(1).optional(),
  PRIVY_APP_SECRET: z.string().min(32, "PRIVY_APP_SECRET must be at least 32 characters").optional(),
  PRIVY_CUSTOM_AUTH_PRIVATE_KEY: z.string().min(1).optional(),
  PRIVY_CUSTOM_AUTH_KEY_ID: z.string().min(1).optional(),
  PRIVY_CUSTOM_AUTH_ISSUER: z.string().min(1).default("vesta"),
  WEBAUTHN_ALLOWED_ORIGINS: z.string().min(1).optional(),
  WEBAUTHN_ALLOWED_RP_IDS: z.string().min(1).default("localhost"),

  COMMISSION_PER_VERIFICATION_BRL: z
    .string()
    .default("1.37")
    .transform((v) => parseFloat(v)),
  COMMISSION_SECURITY_MINUTES: z
    .string()
    .default("30")
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().nonnegative()),
  STELLAR_PAYOUT_ASSET_CODE: z.string().min(1).default("BRL"),
  STELLAR_PAYOUT_ASSET_ISSUER: z.string().min(1).optional(),
  STELLAR_PAYOUT_ASSET_DECIMALS: z
    .string()
    .default("7")
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(0).max(18)),
  STELLAR_PAYOUT_CONTRACT_ID: z.string().min(1).default("PLACEHOLDER"),
  STELLAR_PAYOUT_OPERATOR_SECRET: z.string().optional().default(""),
  PAYOUT_PROCESSOR_INTERVAL_MS: z
    .string()
    .default("10000")
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(1000)),
  COMMISSION_REGISTRATION_PROCESSOR_INTERVAL_MS: z
    .string()
    .default("10000")
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(1000)),
});

const envSchema = envObject.superRefine(refineEnv);

export const validate = { validate: envConfig };
