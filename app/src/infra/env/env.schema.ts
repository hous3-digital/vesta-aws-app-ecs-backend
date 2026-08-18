import { z } from "zod";

const envConfig = (config: Record<string, unknown>) => {
  const result = envSchema.parse(config);
  return result;
};

const envSchema = z.object({
  NODE_ENV: z.enum(["local", "test", "development", "production"]),

  PORT: z
    .string()
    .default("3000")
    .transform((val) => parseInt(val, 10)),

  DATABASE_URL: z.string().url(),

  STELLAR_RPC_URL: z.string().url().default("https://soroban-testnet.stellar.org"),
  STELLAR_NETWORK: z.string().min(1).default("Test SDF Network ; September 2015"),
  VESTA_CONTRACT_ID: z.string().min(1).default("PLACEHOLDER"),
  VESTA_DEPLOYER_SECRET: z.string().optional().default(""),
  ZK_ARTIFACTS_DIR: z.string().min(1).default("./zk-artifacts"),
  ZK_MOCK_MODE: z
    .string()
    .transform((v) => v === "true")
    .default(true),

  CPF_HMAC_SECRET: z.string().min(32, "CPF_HMAC_SECRET must be at least 32 characters"),

  CORS_ALLOWED_ORIGINS: z.string().optional().default(""),

  REDIS_URL: z.string().optional(),

  ADMIN_SECRET: z.string().min(32, "ADMIN_SECRET must be at least 32 characters").optional(),
  BACKOFFICE_JWT_SECRET: z.string().min(32, "BACKOFFICE_JWT_SECRET must be at least 32 characters").optional(),
  BACKOFFICE_JWT_EXPIRES_IN: z.string().min(1).optional().default("8h"),

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
});

export const validate = { validate: envConfig };
