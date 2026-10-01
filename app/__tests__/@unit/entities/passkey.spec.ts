import { Passkey } from "@src/modules/challenge/domain/passkey.entity";
import { ForbiddenError } from "@src/shared/errors";

const PASSKEY_ID = "aJK60rKMjZX5yADEkB7HyQ";
const ISSUER_ID = "issuer_local_dev";

const restoreWith = (counter: number): Passkey =>
  Passkey.restore({
    id: PASSKEY_ID,
    issuerId: ISSUER_ID,
    vcHash: "ab".repeat(32),
    rpId: "app.example.com",
    counter: counter,
  });

describe("Passkey", () => {
  describe("authenticate", () => {
    it("advances the counter when the assertion counter is greater than the stored one", () => {
      // Arrange
      const passkey = restoreWith(7);

      // Act
      passkey.authenticate(8);

      // Assert
      expect(passkey.counter).toBe(8);
    });

    it("advances from zero when the authenticator starts counting", () => {
      // Arrange
      const passkey = restoreWith(0);

      // Act
      passkey.authenticate(1);

      // Assert
      expect(passkey.counter).toBe(1);
    });

    it("keeps accepting zero while the stored counter is zero: synced passkeys never increment", () => {
      // Arrange
      const passkey = restoreWith(0);

      // Act
      passkey.authenticate(0);

      // Assert
      expect(passkey.counter).toBe(0);
    });

    it.each([
      { stored: 7, received: 7, label: "equal to the stored one" },
      { stored: 7, received: 5, label: "below the stored one" },
      { stored: 7, received: 0, label: "reset to zero after the stored one moved" },
    ])("CT-VESTA-PASS-004 refuses a counter $label as a cloned authenticator", ({ stored, received }) => {
      // Arrange
      const passkey = restoreWith(stored);

      // Act
      const act = (): void => passkey.authenticate(received);

      // Assert
      expect(act).toThrow(ForbiddenError);
      expect(act).toThrow(
        expect.objectContaining({
          code: "PASSKEY_COUNTER_REGRESSION",
          details: { issuerId: passkey.issuerId, passkeyId: passkey.id },
        }),
      );
      expect(passkey).toMatchObject({
        id: PASSKEY_ID,
        issuerId: ISSUER_ID,
        vcHash: "ab".repeat(32),
        rpId: "app.example.com",
        counter: stored,
      });
    });
  });
});
