import { UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { BackofficeAuthService } from "@src/infra/auth/backoffice-auth.service";
import type { PrismaService } from "@src/infra/database/@prisma/prisma.service";
import type { EnvService } from "@src/infra/env/env.service";
import { mockEnvService, type EnvServiceDouble } from "@test/mocks/service/env.service.mock";

const PASSWORD = "test-only-password";
const user = { id: "bo_user_1", issuerId: "issuer_a", email: "dev@localhost", name: "Dev", active: true };

const makeSut = async (overrides: Partial<EnvServiceDouble> = {}) => {
  const envService = mockEnvService(overrides);
  const passwordHash = await bcrypt.hash(PASSWORD, 4);
  const prisma = {
    backofficeUser: { findFirst: jest.fn().mockResolvedValue({ ...user, passwordHash }) },
  } as unknown as PrismaService;
  const jwtService = new JwtService();
  const sut = new BackofficeAuthService(prisma, jwtService, envService as unknown as EnvService);
  return { sut, jwtService, envService };
};

const claimsOf = (token: string): { iat?: number; exp?: number } =>
  JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")) as { iat?: number; exp?: number };

/** A token signed the way BACKOFFICE_JWT_EXPIRES_IN=never used to sign: no exp claim. */
const tokenWithoutExp = (jwtService: JwtService, secret: string): Promise<string> =>
  jwtService.signAsync({ issuerId: user.issuerId, email: user.email, name: user.name }, { secret, subject: user.id });

describe("BackofficeAuthService", () => {
  it("CT-VESTA-AUTH-010 signs a digit-only BACKOFFICE_JWT_EXPIRES_IN as seconds, matching expiresIn", async () => {
    // Arrange
    const { sut } = await makeSut({ BACKOFFICE_JWT_EXPIRES_IN: "3600" });

    // Act
    const result = await sut.login(user.email, PASSWORD);

    // Assert
    const { iat, exp } = claimsOf(result.accessToken);
    expect(result.expiresIn).toBe(3600);
    expect(iat).toEqual(expect.any(Number));
    expect(exp).toBe(Number(iat) + 3600);
  });

  it("CT-VESTA-AUTH-010 refuses a token without exp outside local", async () => {
    // Arrange
    const { sut, jwtService, envService } = await makeSut({ NODE_ENV: "test" });
    const token = await tokenWithoutExp(jwtService, envService.BACKOFFICE_JWT_SECRET);

    // Act
    const act = sut.verifyBearer(token);

    // Assert
    await expect(act).rejects.toThrow(UnauthorizedException);
    await expect(act).rejects.toMatchObject({ message: "Backoffice session expired" });
  });

  it("CT-VESTA-AUTH-010 still accepts a token without exp in local, where never is allowed", async () => {
    // Arrange
    const { sut, jwtService, envService } = await makeSut({ NODE_ENV: "local" });
    const token = await tokenWithoutExp(jwtService, envService.BACKOFFICE_JWT_SECRET);

    // Act
    const session = await sut.verifyBearer(token);

    // Assert
    expect(session.userId).toBe(user.id);
  });
});
