import {
  buildCorsOptions,
  CORS_ALLOWED_HEADERS,
  CORS_ALLOWED_METHODS,
  CORS_PREFLIGHT_MAX_AGE_SECONDS,
  corsOptionsFor,
  parseCorsOrigins,
} from "@src/infra/http/cors.config";

const ORIGIN = "https://backoffice.example.com";

describe("buildCorsOptions", () => {
  it("CT-VESTA-SEC-002 allows the backoffice write methods in an explicit list", () => {
    // Arrange
    const writeMethods = ["PUT", "PATCH", "DELETE"];

    // Act
    const options = buildCorsOptions(ORIGIN);

    // Assert
    expect(options.methods).toEqual([...CORS_ALLOWED_METHODS]);
    expect(options.methods).toEqual(expect.arrayContaining(["GET", "POST", "OPTIONS", ...writeMethods]));
    expect(options.methods).not.toContain("*");
  });

  it("CT-VESTA-SEC-002 lists the allowed headers explicitly and keeps the admin secret out", () => {
    // Act
    const options = buildCorsOptions(ORIGIN);

    // Assert
    expect(options.allowedHeaders).toEqual([...CORS_ALLOWED_HEADERS]);
    expect(options.allowedHeaders).toEqual(
      expect.arrayContaining(["Authorization", "Content-Type", "X-Api-Key", "Idempotency-Key"]),
    );
    expect(options.allowedHeaders).not.toContain("*");
    expect(options.allowedHeaders).not.toContain("X-Admin-Secret");
  });

  it("does not allow credentials because no consumer sends cookies", () => {
    // Act
    const options = buildCorsOptions(ORIGIN);

    // Assert
    expect(options.credentials).toBe(false);
  });

  it("lets the browser cache the preflight for ten minutes", () => {
    // Act
    const options = buildCorsOptions(ORIGIN);

    // Assert
    expect(options.maxAge).toBe(CORS_PREFLIGHT_MAX_AGE_SECONDS);
    expect(options.maxAge).toBe(600);
  });
});

describe("parseCorsOrigins", () => {
  it("keeps an exact origin as a string", () => {
    // Act
    const origins = parseCorsOrigins(ORIGIN);

    // Assert
    expect(origins).toEqual([ORIGIN]);
  });

  it("keeps an explicit port and the http scheme for local fronts", () => {
    // Act
    const origins = parseCorsOrigins("http://localhost:5173");

    // Assert
    expect(origins).toEqual(["http://localhost:5173"]);
  });

  it("turns a wildcard entry into an anchored pattern over host characters only", () => {
    // Arrange
    const entry = "https://*.example.com";

    // Act
    const [pattern] = parseCorsOrigins(entry);

    // Assert
    expect(pattern).toBeInstanceOf(RegExp);
    const regex = pattern as RegExp;
    expect(regex.test("https://app.example.com")).toBe(true);
    expect(regex.test("https://app.example.com.evil.net")).toBe(false);
    expect(regex.test("https://evil.net/https://app.example.com")).toBe(false);
    expect(regex.test("http://app.example.com")).toBe(false);
  });

  it("trims entries and drops empty ones", () => {
    // Arrange
    const raw = ` ${ORIGIN} , ,https://demo.example.org,`;

    // Act
    const origins = parseCorsOrigins(raw);

    // Assert
    expect(origins).toEqual([ORIGIN, "https://demo.example.org"]);
  });

  it("returns no origin for an empty value, so nothing is allowed by accident", () => {
    // Act
    const origins = parseCorsOrigins("");

    // Assert
    expect(origins).toEqual([]);
  });

  it.each([
    ["no scheme", "backoffice.example.com"],
    ["a trailing slash", "https://backoffice.example.com/"],
    ["a path", "https://backoffice.example.com/app"],
    ["a wildcard as the whole host", "https://*"],
    ["a wildcard as the whole host with a port", "https://*:3000"],
  ])("rejects an entry with %s instead of ignoring it silently", (_label, entry) => {
    // Act
    const act = (): unknown => parseCorsOrigins(`${ORIGIN},${entry}`);

    // Assert
    expect(act).toThrow(/CORS_ALLOWED_ORIGINS/);
    expect(act).toThrow(entry);
  });
});

describe("corsOptionsFor", () => {
  it("builds the policy from the list whenever one is set, whatever the environment", () => {
    // Act
    const production = corsOptionsFor({ allowedOrigins: ORIGIN, nodeEnv: "production" });
    const test = corsOptionsFor({ allowedOrigins: ORIGIN, nodeEnv: "test" });

    // Assert
    expect(production).toEqual(buildCorsOptions(ORIGIN));
    expect(test).toEqual(buildCorsOptions(ORIGIN));
  });

  it("keeps CORS off in every deployed environment without a list", () => {
    // Act
    const production = corsOptionsFor({ allowedOrigins: "", nodeEnv: "production" });
    const test = corsOptionsFor({ allowedOrigins: "", nodeEnv: "test" });
    const development = corsOptionsFor({ allowedOrigins: "", nodeEnv: "development" });

    // Assert
    expect(production).toBeNull();
    expect(test).toBeNull();
    expect(development).toBeNull();
  });

  it("opens the origin only on a local machine without a list, with the same method and header lists", () => {
    // Act
    const options = corsOptionsFor({ allowedOrigins: "", nodeEnv: "local" });

    // Assert
    expect(options).not.toBeNull();
    expect(options?.origin).toBe(true);
    expect(options?.methods).toEqual([...CORS_ALLOWED_METHODS]);
    expect(options?.allowedHeaders).toEqual([...CORS_ALLOWED_HEADERS]);
    expect(options?.credentials).toBe(false);
  });
});
