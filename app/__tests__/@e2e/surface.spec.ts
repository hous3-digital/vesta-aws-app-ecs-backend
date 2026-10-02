import request = require("supertest");
import { E2E_CORS_ORIGIN, FIXTURE_API_KEY, FIXTURE_VERIFIER_ID } from "@test/constants";
import { createTestApp, TestApp } from "@test/helpers/create-test-app.helper";

describe("surface", () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  it("CT-VESTA-SURF-001 health returns ok without authentication", async () => {
    // Act
    const response = await request(testApp.app.getHttpServer()).get("/health");

    // Assert
    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).toContain("ok");
  });

  it("CT-VESTA-SURF-003 a public route without API key returns 401", async () => {
    // Act
    const response = await request(testApp.app.getHttpServer()).get("/public/auth/challenge");

    // Assert
    expect(response.status).toBe(401);
  });

  it("CT-VESTA-SURF-004 an invalid API key returns 401", async () => {
    // Act
    const response = await request(testApp.app.getHttpServer())
      .get("/public/auth/challenge")
      .set("X-Api-Key", "vesta_live_not_a_key");

    // Assert
    expect(response.status).toBe(401);
  });

  it("CT-VESTA-AUTH-004 the API key is accepted via X-Api-Key and via Authorization Bearer", async () => {
    // Act
    const viaHeader = await request(testApp.app.getHttpServer())
      .get("/public/auth/challenge")
      .set("X-Api-Key", FIXTURE_API_KEY);
    const viaBearer = await request(testApp.app.getHttpServer())
      .get("/public/auth/challenge")
      .set("Authorization", `Bearer ${FIXTURE_API_KEY}`);

    // Assert
    expect(viaHeader.status).toBe(200);
    expect(viaBearer.status).toBe(200);
    expect(viaHeader.body.data.challenge).toEqual(expect.any(String));
  });

  it("CT-VESTA-ADMIN-010 an admin route without the secret returns 401", async () => {
    // Act
    const response = await request(testApp.app.getHttpServer()).get("/admin/api-keys");

    // Assert
    expect(response.status).toBe(401);
  });

  it("CT-VESTA-SEC-002 the preflight of a backoffice PATCH is accepted without credentials", async () => {
    // Act
    const response = await request(testApp.app.getHttpServer())
      .options(`/backoffice/admin/verifiers/${FIXTURE_VERIFIER_ID}`)
      .set("Origin", E2E_CORS_ORIGIN)
      .set("Access-Control-Request-Method", "PATCH")
      .set("Access-Control-Request-Headers", "authorization,content-type");

    // Assert
    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(E2E_CORS_ORIGIN);
    expect(response.headers["access-control-allow-methods"]).toContain("PATCH");
    expect(response.headers["access-control-allow-methods"]).toContain("DELETE");
    expect(response.headers["access-control-allow-headers"]).toBe(
      "Authorization,Content-Type,X-Api-Key,Idempotency-Key",
    );
    expect(response.headers["access-control-max-age"]).toBe("600");
    expect(response.headers["access-control-allow-credentials"]).toBeUndefined();
  });

  it("CT-VESTA-SEC-002 the preflight from an origin outside the list carries no allow-origin header", async () => {
    // Act
    const response = await request(testApp.app.getHttpServer())
      .options(`/backoffice/admin/verifiers/${FIXTURE_VERIFIER_ID}`)
      .set("Origin", "https://evil.example.net")
      .set("Access-Control-Request-Method", "PATCH");

    // Assert
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("CT-VESTA-SEC-002 the preflight of an SDK call with the API key header is accepted on /public", async () => {
    // Act
    const response = await request(testApp.app.getHttpServer())
      .options("/public/auth/challenge")
      .set("Origin", E2E_CORS_ORIGIN)
      .set("Access-Control-Request-Method", "GET")
      .set("Access-Control-Request-Headers", "x-api-key,content-type");

    // Assert
    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(E2E_CORS_ORIGIN);
    expect(response.headers["access-control-allow-headers"]).toContain("X-Api-Key");
  });

  it("CT-VESTA-SEC-002 an actual cross-origin request carries the allow-origin header and varies on Origin", async () => {
    // Act
    const response = await request(testApp.app.getHttpServer()).get("/health").set("Origin", E2E_CORS_ORIGIN);

    // Assert
    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe(E2E_CORS_ORIGIN);
    expect(response.headers["vary"]).toContain("Origin");
    expect(response.headers["access-control-allow-credentials"]).toBeUndefined();
  });
});
