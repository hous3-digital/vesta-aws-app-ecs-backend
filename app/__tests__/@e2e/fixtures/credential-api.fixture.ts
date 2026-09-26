import { faker } from "@faker-js/faker";
import { generateCpf } from "@test/helpers/generate-cpf.helper";

export class CredentialApiFixture {
  public static issue(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      cpf: generateCpf(),
      fullName: faker.person.fullName(),
      birthDate: "1990-05-20",
      kycLevel: "complete",
      kycMethod: "document_ocr",
      ...overrides,
    };
  }
}
