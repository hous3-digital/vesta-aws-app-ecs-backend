import { faker } from "@faker-js/faker";

/** Bodies for the /admin routes. Issuer ids and emails are random so files never collide in the shared database. */
export class AdminApiFixture {
  public static issuerId(): string {
    return `e2e_${faker.string.alphanumeric({ length: 12, casing: "lower" })}`;
  }

  public static createIssuer(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      issuerId: AdminApiFixture.issuerId(),
      name: faker.company.name(),
      roles: ["TECHNICAL", "COMMERCIAL"],
      authorizedCredentialTypes: ["VestaKYCCredential"],
      ...overrides,
    };
  }

  public static createBackofficeUser(
    issuerId: string,
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      issuerId,
      email: `e2e_${faker.string.alphanumeric({ length: 10, casing: "lower" })}@${faker.internet.domainName()}`,
      name: faker.person.fullName(),
      password: faker.internet.password({ length: 20 }),
      ...overrides,
    };
  }

  public static createApiKey(issuerId: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      issuerId,
      name: `e2e ${faker.word.words(2)}`,
      ...overrides,
    };
  }
}
