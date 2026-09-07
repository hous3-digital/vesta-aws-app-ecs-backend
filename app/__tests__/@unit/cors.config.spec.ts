import { Test } from "@nestjs/testing";
import { CORS_ALLOWED_HEADERS } from "@src/infra/http/cors.config";
import request = require("supertest");

describe("CORS configuration", () => {
  it("aceita o preflight do repasse com autenticação e chave de idempotência", async () => {
    const moduleRef = await Test.createTestingModule({}).compile();
    const app = moduleRef.createNestApplication();
    app.enableCors({
      origin: ["https://backoffice.trust-staging.com"],
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: [...CORS_ALLOWED_HEADERS],
      credentials: true,
    });
    await app.init();

    await request(app.getHttpServer())
      .options("/backoffice/payouts")
      .set("Origin", "https://backoffice.trust-staging.com")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "authorization,idempotency-key")
      .expect(204)
      .expect("Access-Control-Allow-Origin", "https://backoffice.trust-staging.com")
      .expect("Access-Control-Allow-Credentials", "true")
      .expect("Access-Control-Allow-Headers", "Authorization,Content-Type,X-Api-Key,Idempotency-Key");

    await app.close();
  });
});
