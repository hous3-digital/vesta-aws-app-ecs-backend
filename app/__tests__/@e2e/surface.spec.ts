import request = require("supertest");
import { FIXTURE_API_KEY } from "@test/constants";
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
});
