import { BadRequestException } from "@nestjs/common";
import { Verifier, VerifierStatus } from "@src/modules/backoffice/verifiers/domain/verifier.entity";

const restoreWith = (status: VerifierStatus): Verifier =>
  Verifier.restore({
    id: "verifier_local",
    name: "Verifier Local",
    status: status,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  });

describe("Verifier", () => {
  describe("create", () => {
    it("creates an active verifier", () => {
      // Arrange & Act
      const verifier = Verifier.create({ id: "verifier_local", name: "Verifier Local" });

      // Assert
      expect(verifier.status).toBe(VerifierStatus.Active);
      expect(verifier.createdAt).toEqual(verifier.updatedAt);
    });

    it.each([
      ["id", { id: "  ", name: "Verifier Local" }],
      ["name", { id: "verifier_local", name: "" }],
    ])("rejects a blank %s", (_field, params) => {
      // Act
      const act = () => Verifier.create(params);

      // Assert
      expect(act).toThrow(BadRequestException);
    });
  });

  it("CT-VESTA-BO-006 rename changes the name and touches updatedAt", () => {
    // Arrange
    const verifier = restoreWith(VerifierStatus.Active);
    const before = verifier.updatedAt;

    // Act
    verifier.rename("Verifier Renamed");

    // Assert
    expect(verifier.name).toBe("Verifier Renamed");
    expect(verifier.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });

  it("rename rejects a blank name", () => {
    // Arrange
    const verifier = restoreWith(VerifierStatus.Active);

    // Act
    const act = () => verifier.rename(" ");

    // Assert
    expect(act).toThrow(BadRequestException);
  });

  describe("revoke and reactivate", () => {
    it("revoke moves active to revoked and refuses a second revoke", () => {
      // Arrange
      const verifier = restoreWith(VerifierStatus.Active);

      // Act
      verifier.revoke();

      // Assert
      expect(verifier.status).toBe(VerifierStatus.Revoked);
      expect(() => verifier.revoke()).toThrow(BadRequestException);
    });

    it("reactivate moves revoked to active and refuses a second reactivate", () => {
      // Arrange
      const verifier = restoreWith(VerifierStatus.Revoked);

      // Act
      verifier.reactivate();

      // Assert
      expect(verifier.status).toBe(VerifierStatus.Active);
      expect(() => verifier.reactivate()).toThrow(BadRequestException);
    });
  });
});
