import { Id } from "@src/shared/value-objects/id.value-object";

describe("Id", () => {
  it("create generates a TypeID with the given prefix", () => {
    // Arrange & Act
    const id = Id.create("credential");

    // Assert
    expect(id.value).toMatch(/^credential_[0-9a-hjkmnp-tv-z]{26}$/);
  });

  it("two created ids are never equal", () => {
    // Arrange
    const first = Id.create("credential");
    const second = Id.create("credential");

    // Act & Assert
    expect(first.equals(second)).toBe(false);
  });

  it("restore keeps the value and equals compares by value", () => {
    // Arrange
    const restored = Id.restore("credential_01abc");
    const same = Id.restore("credential_01abc");

    // Act & Assert
    expect(restored.value).toBe("credential_01abc");
    expect(restored.equals(same)).toBe(true);
  });
});
