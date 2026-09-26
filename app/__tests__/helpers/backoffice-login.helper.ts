import request = require("supertest");
import { FIXTURE_BACKOFFICE_EMAIL, FIXTURE_BACKOFFICE_PASSWORD } from "@test/constants";
import type { TestApp } from "@test/helpers/create-test-app.helper";

/** Logs in through the real route and returns the bearer token. Defaults to the local fixture user. */
export async function loginBackoffice(
  testApp: TestApp,
  email: string = FIXTURE_BACKOFFICE_EMAIL,
  password: string = FIXTURE_BACKOFFICE_PASSWORD,
): Promise<string> {
  const response = await request(testApp.app.getHttpServer()).post("/backoffice/auth/login").send({ email, password });
  if (response.status !== 201 || typeof response.body?.data?.accessToken !== "string") {
    throw new Error(`backoffice login failed for ${email}: ${response.status}`);
  }
  return response.body.data.accessToken as string;
}
