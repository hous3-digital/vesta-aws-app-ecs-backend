import type { ConfigService } from "@nestjs/config";
import { EnvService } from "@src/infra/env/env.service";

const makeSut = (values: Record<string, unknown>) => {
  const configService = { get: jest.fn((name: string) => values[name]) } as unknown as ConfigService;
  const sut = new EnvService(configService);
  return { sut };
};

describe("EnvService optional Privy variables", () => {
  it.each(["PRIVY_APP_ID", "PRIVY_APP_SECRET", "PRIVY_CUSTOM_AUTH_PRIVATE_KEY", "PRIVY_CUSTOM_AUTH_KEY_ID"] as const)(
    "reads %s as absent when the process environment holds an empty string",
    (variable) => {
      // Arrange
      const { sut } = makeSut({ [variable]: "" });

      // Act
      const value = sut[variable];

      // Assert
      expect(value).toBeUndefined();
    },
  );

  it("returns a set value unchanged", () => {
    // Arrange
    const { sut } = makeSut({ PRIVY_CUSTOM_AUTH_KEY_ID: "test-key-2026" });

    // Act
    const value = sut.PRIVY_CUSTOM_AUTH_KEY_ID;

    // Assert
    expect(value).toBe("test-key-2026");
  });
});
