import { secretsMatch } from "@src/shared/crypto/secrets-match";

const EXPECTED = "test-only-secret-with-thirty-two-plus-characters";

describe("secretsMatch", () => {
  it("CT-VESTA-SEC-006 accepts a provided secret equal to the expected one", () => {
    // Arrange
    const provided = EXPECTED;

    // Act
    const result = secretsMatch(EXPECTED, provided);

    // Assert
    expect(result).toBe(true);
  });

  it("CT-VESTA-SEC-006 rejects a secret of the same length with different content", () => {
    // Arrange
    const provided = EXPECTED.slice(0, -1) + "X";

    // Act
    const result = secretsMatch(EXPECTED, provided);

    // Assert
    expect(result).toBe(false);
  });

  it("CT-VESTA-SEC-006 rejects a secret of a different length without throwing", () => {
    // Arrange
    const provided = EXPECTED.slice(0, 10);

    // Act
    const act = () => secretsMatch(EXPECTED, provided);

    // Assert
    expect(act).not.toThrow();
    expect(act()).toBe(false);
  });
});
