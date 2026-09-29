import { ApiKey, ROTATION_GRACE_DAYS, type ApiKeyProps } from "@src/modules/api-key/domain/api-key.entity";
import { InvalidStateError, ValidationError } from "@src/shared/errors";
import { Id } from "@src/shared/value-objects/id.value-object";

const NOW = new Date("2026-09-28T12:00:00.000Z");
const ISSUER_ID = "issuer_local_dev";

const restoreWith = (overrides: Partial<ApiKeyProps> = {}): ApiKey =>
  ApiKey.restore({
    id: Id.restore("ak_01"),
    issuerId: ISSUER_ID,
    keyHash: "a".repeat(64),
    keyPrefix: "vesta_live_aaaaaaaa",
    name: "Local SDK",
    active: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    revokedAt: null,
    expiresAt: null,
    ...overrides,
  });

describe("ApiKey", () => {
  describe("create", () => {
    it("creates an active key with an ak id, no expiry and the secret's hash and prefix", () => {
      // Arrange & Act
      const { apiKey, secret } = ApiKey.create({ name: "SDK", issuerId: ISSUER_ID });

      // Assert
      expect(apiKey.id.value).toMatch(/^ak_[0-9a-hjkmnp-tv-z]{26}$/);
      expect(apiKey.active).toBe(true);
      expect(apiKey.expiresAt).toBeNull();
      expect(apiKey.revokedAt).toBeNull();
      expect(apiKey.keyHash).toBe(secret.hash);
      expect(apiKey.keyPrefix).toBe(secret.prefix);
    });

    it("keeps no copy of the clear secret", () => {
      // Arrange & Act
      const { apiKey, secret } = ApiKey.create({ name: "SDK", issuerId: ISSUER_ID });

      // Assert
      expect(JSON.stringify(apiKey)).not.toContain(secret.value);
    });

    it("trims the name", () => {
      // Arrange & Act
      const { apiKey } = ApiKey.create({ name: "  SDK  ", issuerId: ISSUER_ID });

      // Assert
      expect(apiKey.name).toBe("SDK");
    });

    it.each(["", "   "])("rejects the name %j with API_KEY_NAME_REQUIRED", (name) => {
      // Arrange
      const act = () => ApiKey.create({ name, issuerId: ISSUER_ID });

      // Act & Assert
      expect(act).toThrow(ValidationError);
      expect(act).toThrow(expect.objectContaining({ code: "API_KEY_NAME_REQUIRED" }));
    });
  });

  describe("revoke", () => {
    it("deactivates the key and records when", () => {
      // Arrange
      const apiKey = restoreWith();

      // Act
      apiKey.revoke(NOW);

      // Assert
      expect(apiKey.active).toBe(false);
      expect(apiKey.revokedAt).toEqual(NOW);
    });

    it("rejects a second revoke with API_KEY_ALREADY_REVOKED", () => {
      // Arrange
      const apiKey = restoreWith({ active: false, revokedAt: new Date("2026-02-01T00:00:00.000Z") });
      const act = () => apiKey.revoke(NOW);

      // Act & Assert
      expect(act).toThrow(InvalidStateError);
      expect(act).toThrow(expect.objectContaining({ code: "API_KEY_ALREADY_REVOKED" }));
    });
  });

  describe("rotate", () => {
    it("creates a key for the same issuer and name and returns its secret once", () => {
      // Arrange
      const apiKey = restoreWith();

      // Act
      const { next, secret } = apiKey.rotate(NOW);

      // Assert
      expect(next.issuerId).toBe(ISSUER_ID);
      expect(next.name).toBe(apiKey.name);
      expect(next.id.equals(apiKey.id)).toBe(false);
      expect(next.keyHash).toBe(secret.hash);
      expect(next.expiresAt).toBeNull();
    });

    it("gives the rotated key a grace period of ROTATION_GRACE_DAYS from now", () => {
      // Arrange
      const apiKey = restoreWith();
      const graceEnd = new Date(NOW.getTime() + ROTATION_GRACE_DAYS * 24 * 60 * 60 * 1000);

      // Act
      const { expiresAt } = apiKey.rotate(NOW);

      // Assert
      expect(expiresAt).toEqual(graceEnd);
      expect(apiKey.expiresAt).toEqual(graceEnd);
      expect(apiKey.isUsable(NOW)).toBe(true);
      expect(apiKey.isUsable(graceEnd)).toBe(false);
    });

    it.each([
      ["revoked", { active: false, revokedAt: NOW }, "API_KEY_REVOKED"],
      ["without issuer", { issuerId: null }, "API_KEY_WITHOUT_ISSUER"],
      ["expired", { expiresAt: new Date("2026-09-01T00:00:00.000Z") }, "API_KEY_EXPIRED"],
      ["already in its grace period", { expiresAt: new Date("2026-10-20T00:00:00.000Z") }, "API_KEY_ALREADY_ROTATED"],
    ] as const)("refuses to rotate a key that is %s with %s", (_label, overrides, code) => {
      // Arrange
      const apiKey = restoreWith(overrides);
      const act = () => apiKey.rotate(NOW);

      // Act & Assert
      expect(act).toThrow(InvalidStateError);
      expect(act).toThrow(expect.objectContaining({ code }));
    });
  });

  describe("isExpired", () => {
    it.each([
      ["no expiry", null, false],
      ["expiry in the future", new Date("2026-10-28T12:00:00.000Z"), false],
      ["expiry exactly now", NOW, true],
      ["expiry in the past", new Date("2026-09-01T00:00:00.000Z"), true],
    ])("with %s answers %s", (_label, expiresAt, expected) => {
      // Arrange
      const apiKey = restoreWith({ expiresAt });

      // Act
      const expired = apiKey.isExpired(NOW);

      // Assert
      expect(expired).toBe(expected);
    });
  });

  describe("isUsable and ensureUsable", () => {
    it("accepts an active key linked to an issuer and not expired", () => {
      // Arrange
      const apiKey = restoreWith({ expiresAt: new Date("2026-10-28T12:00:00.000Z") });

      // Act
      const usable = apiKey.isUsable(NOW);

      // Assert
      expect(usable).toBe(true);
      expect(() => apiKey.ensureUsable(NOW)).not.toThrow();
    });

    it.each([
      ["revoked", { active: false, revokedAt: NOW }, "API_KEY_REVOKED"],
      ["without issuer", { issuerId: null }, "API_KEY_WITHOUT_ISSUER"],
      ["expired", { expiresAt: new Date("2026-09-01T00:00:00.000Z") }, "API_KEY_EXPIRED"],
    ] as const)("refuses a key that is %s with %s", (_label, overrides, code) => {
      // Arrange
      const apiKey = restoreWith(overrides);
      const act = () => apiKey.ensureUsable(NOW);

      // Act & Assert
      expect(apiKey.isUsable(NOW)).toBe(false);
      expect(act).toThrow(InvalidStateError);
      expect(act).toThrow(expect.objectContaining({ code }));
    });
  });
});
