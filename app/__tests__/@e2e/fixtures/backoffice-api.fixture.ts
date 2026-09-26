import { faker } from "@faker-js/faker";
import { FIXTURE_BACKOFFICE_EMAIL, FIXTURE_BACKOFFICE_PASSWORD } from "@test/constants";

/** Bodies for the /backoffice routes. */
export class BackofficeApiFixture {
  public static login(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      email: FIXTURE_BACKOFFICE_EMAIL,
      password: FIXTURE_BACKOFFICE_PASSWORD,
      ...overrides,
    };
  }

  public static createApiKey(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      name: `e2e ${faker.word.words(2)}`,
      ...overrides,
    };
  }
}
