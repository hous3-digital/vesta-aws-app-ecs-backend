import { validate } from "@src/infra/env/env.schema";
import { generateKeyPairSync } from "node:crypto";

/** The smallest configuration the schema accepts; every secret is a test constant. */
const BASE_ENV: Record<string, string> = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/vesta_test",
  CPF_HMAC_SECRET: "test-only-cpf-hmac-secret-with-32-plus-chars",
  ADMIN_SECRET: "test-only-admin-secret-with-thirty-two-plus-chars",
  BACKOFFICE_JWT_SECRET: "test-only-backoffice-jwt-secret-with-32-plus-chars",
};

const KEY_ID = "test-key-2026";

/** A fresh key per run: nothing here is a real credential. */
function privateKeyPem(namedCurve: "P-256" | "P-384"): string {
  return generateKeyPairSync("ec", {
    namedCurve,
    privateKeyEncoding: { format: "pem", type: "pkcs8" },
    publicKeyEncoding: { format: "pem", type: "spki" },
  }).privateKey;
}

const parse = (overrides: Record<string, string>): Record<string, unknown> =>
  validate.validate({ ...BASE_ENV, ...overrides }) as Record<string, unknown>;

describe("env schema, Privy variables", () => {
  it.each(["PRIVY_APP_ID", "PRIVY_APP_SECRET", "PRIVY_CUSTOM_AUTH_PRIVATE_KEY", "PRIVY_CUSTOM_AUTH_KEY_ID"])(
    "reads %s set to an empty string as absent, so .env.example boots",
    (variable) => {
      // Act
      const env = parse({ [variable]: "" });

      // Assert
      expect(env[variable]).toBeUndefined();
    },
  );

  it("accepts the custom auth pair with a PEM in one line and restores its line breaks", () => {
    // Arrange
    const pem = privateKeyPem("P-256");
    const oneLine = pem.replace(/\n/g, "\\n");

    // Act
    const env = parse({ PRIVY_CUSTOM_AUTH_PRIVATE_KEY: oneLine, PRIVY_CUSTOM_AUTH_KEY_ID: KEY_ID });

    // Assert
    expect(env.PRIVY_CUSTOM_AUTH_PRIVATE_KEY).toBe(pem);
    expect(env.PRIVY_CUSTOM_AUTH_KEY_ID).toBe(KEY_ID);
  });

  it("rejects a private key id without the key, naming the missing variable", () => {
    // Act
    const act = (): unknown => parse({ PRIVY_CUSTOM_AUTH_KEY_ID: KEY_ID });

    // Assert
    expect(act).toThrow(/PRIVY_CUSTOM_AUTH_PRIVATE_KEY/);
  });

  it("rejects a private key without the key id, naming the missing variable", () => {
    // Act
    const act = (): unknown => parse({ PRIVY_CUSTOM_AUTH_PRIVATE_KEY: privateKeyPem("P-256") });

    // Assert
    expect(act).toThrow(/PRIVY_CUSTOM_AUTH_KEY_ID/);
  });

  it.each([
    ["text that is not a key", "not-a-pem"],
    ["a key on another curve", privateKeyPem("P-384")],
  ])("rejects %s as the private key, naming the variable and never the value", (_label, value) => {
    // Act
    const act = (): unknown => parse({ PRIVY_CUSTOM_AUTH_PRIVATE_KEY: value, PRIVY_CUSTOM_AUTH_KEY_ID: KEY_ID });

    // Assert
    expect(act).toThrow(/PRIVY_CUSTOM_AUTH_PRIVATE_KEY/);
    expect(act).not.toThrow(value.slice(0, 40));
  });
});
