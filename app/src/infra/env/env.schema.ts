import { z } from "zod";

const envConfig = (config: Record<string, unknown>) => {
  const result = envSchema.parse(config);
  return result;
};

const envSchema = z.object({
  NODE_ENV: z.enum(["local", "test", "development", "production"]),

  PORT: z.string().transform((val) => parseInt(val, 10)),

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
});

export const validate = { validate: envConfig };
