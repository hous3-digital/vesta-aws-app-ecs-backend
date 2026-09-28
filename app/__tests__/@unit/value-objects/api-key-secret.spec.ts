import { createHash } from "node:crypto";
import { ApiKeySecret } from "@src/modules/api-key/domain/api-key-secret.value-object";

describe("ApiKeySecret", () => {
  describe("generate", () => {
    it("produces a vesta_live_ secret with 48 hex characters of randomness", () => {
      // Arrange & Act
      const secret = ApiKeySecret.generate();

      // Assert
      expect(secret.value).toMatch(/^vesta_live_[0-9a-f]{48}$/);
    });

    it("never produces the same secret twice", () => {
      // Arrange
      const first = ApiKeySecret.generate();

      // Act
      const second = ApiKeySecret.generate();

      // Assert
      expect(second.value).not.toBe(first.value);
    });
  });

  describe("hash", () => {
    it("is the hex SHA-256 of the clear secret", () => {
      // Arrange
      const secret = ApiKeySecret.fromRaw("vesta_live_" + "ab".repeat(24));
      const expected = createHash("sha256").update(secret.value, "utf8").digest("hex");

      // Act
      const hash = secret.hash;

      // Assert
      expect(hash).toBe(expected);
      expect(hash).toHaveLength(64);
    });

    it("is the same for a generated secret and the same value presented later", () => {
      // Arrange
      const generated = ApiKeySecret.generate();

      // Act
      const presented = ApiKeySecret.fromRaw(generated.value);

      // Assert
      expect(presented.hash).toBe(generated.hash);
    });
  });

  describe("prefix", () => {
    it("is vesta_live_ plus the first 8 hex characters", () => {
      // Arrange
      const secret = ApiKeySecret.fromRaw("vesta_live_0123456789abcdef" + "0".repeat(32));

      // Act
      const prefix = secret.prefix;

      // Assert
      expect(prefix).toBe("vesta_live_01234567");
      expect(prefix).toHaveLength(19);
    });
  });

  describe("matchesHash", () => {
    it("accepts the stored hash of the same secret", () => {
      // Arrange
      const secret = ApiKeySecret.generate();

      // Act
      const matches = secret.matchesHash(secret.hash);

      // Assert
      expect(matches).toBe(true);
    });

    it("rejects the hash of another secret", () => {
      // Arrange
      const secret = ApiKeySecret.generate();
      const other = ApiKeySecret.generate();

      // Act
      const matches = secret.matchesHash(other.hash);

      // Assert
      expect(matches).toBe(false);
    });

    it("rejects a stored value of a different length without throwing", () => {
      // Arrange
      const secret = ApiKeySecret.generate();

      // Act
      const matches = secret.matchesHash(secret.hash.slice(0, 63));

      // Assert
      expect(matches).toBe(false);
    });
  });
});
