import type { EnvService } from "@src/infra/env/env.service";

export type EnvServiceDouble = Pick<EnvService, "CPF_HMAC_SECRET">;

/** Only the variables a handler reads; the value is a test constant, never a real secret. */
export function mockEnvService(overrides: Partial<EnvServiceDouble> = {}): EnvServiceDouble {
  return {
    CPF_HMAC_SECRET: "test-only-cpf-hmac-secret",
    ...overrides,
  };
}
