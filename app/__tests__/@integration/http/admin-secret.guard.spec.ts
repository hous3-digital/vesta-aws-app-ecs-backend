import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { AdminSecretGuard } from "@src/infra/auth/admin-secret.guard";
import type { EnvService } from "@src/infra/env/env.service";
import { mockEnvService } from "@test/mocks/service/env.service.mock";

const ADMIN_SECRET = "test-only-admin-secret-with-thirty-two-plus-chars";

const makeContext = (headers: Record<string, string>): ExecutionContext =>
  ({ switchToHttp: () => ({ getRequest: () => ({ headers }) }) }) as unknown as ExecutionContext;

const makeSut = () => {
  const envService = mockEnvService({ ADMIN_SECRET });
  const sut = new AdminSecretGuard(envService as unknown as EnvService);
  return { sut };
};

/** The 401 the guard threw, or null when it let the request through. */
const rejectionOf = (act: () => boolean): UnauthorizedException | null => {
  try {
    act();
    return null;
  } catch (error) {
    if (error instanceof UnauthorizedException) return error;
    throw error;
  }
};

const rejectedHeaders: Array<[string, Record<string, string>]> = [
  ["no header", {}],
  ["a value of a different length", { "x-admin-secret": ADMIN_SECRET.slice(0, 12) }],
  ["a different value of the same length", { "x-admin-secret": ADMIN_SECRET.slice(0, -1) + "X" }],
];

describe("AdminSecretGuard", () => {
  it.each(rejectedHeaders)("CT-VESTA-ADMIN-013 answers the same 401 with %s", (_label, headers) => {
    // Arrange
    const { sut } = makeSut();

    // Act
    const rejection = rejectionOf(() => sut.canActivate(makeContext(headers)));

    // Assert
    expect(rejection).toBeInstanceOf(UnauthorizedException);
    expect(rejection?.message).toBe("Invalid admin secret");
  });

  it("CT-VESTA-ADMIN-013 lets the request through with the correct secret", () => {
    // Arrange
    const { sut } = makeSut();

    // Act
    const result = sut.canActivate(makeContext({ "x-admin-secret": ADMIN_SECRET }));

    // Assert
    expect(result).toBe(true);
  });
});
