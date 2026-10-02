import type { EnvService } from "@src/infra/env/env.service";

export type EnvServiceDouble = Pick<
  EnvService,
  | "NODE_ENV"
  | "CPF_HMAC_SECRET"
  | "ADMIN_SECRET"
  | "BACKOFFICE_JWT_SECRET"
  | "BACKOFFICE_JWT_EXPIRES_IN"
  | "ZK_ARTIFACTS_DIR"
  | "ZK_MOCK_MODE"
  | "WEBAUTHN_ALLOWED_ORIGINS"
  | "WEBAUTHN_ALLOWED_RP_IDS"
  | "PRIVY_APP_ID"
  | "PRIVY_APP_SECRET"
  | "PRIVY_CUSTOM_AUTH_PRIVATE_KEY"
  | "PRIVY_CUSTOM_AUTH_KEY_ID"
  | "PRIVY_CUSTOM_AUTH_ISSUER"
>;

/** Only the variables a handler or service reads; the value is a test constant, never a real secret. */
export function mockEnvService(overrides: Partial<EnvServiceDouble> = {}): EnvServiceDouble {
  return {
    NODE_ENV: "test",
    CPF_HMAC_SECRET: "test-only-cpf-hmac-secret",
    ADMIN_SECRET: "test-only-admin-secret-with-thirty-two-plus-chars",
    BACKOFFICE_JWT_SECRET: "test-only-backoffice-jwt-secret-with-32-plus-chars",
    BACKOFFICE_JWT_EXPIRES_IN: "8h",
    ZK_ARTIFACTS_DIR: "./zk-artifacts",
    ZK_MOCK_MODE: true,
    WEBAUTHN_ALLOWED_ORIGINS: "https://app.example.com",
    WEBAUTHN_ALLOWED_RP_IDS: "app.example.com",
    PRIVY_APP_ID: undefined,
    PRIVY_APP_SECRET: undefined,
    PRIVY_CUSTOM_AUTH_PRIVATE_KEY: undefined,
    PRIVY_CUSTOM_AUTH_KEY_ID: undefined,
    PRIVY_CUSTOM_AUTH_ISSUER: "vesta",
    ...overrides,
  };
}
