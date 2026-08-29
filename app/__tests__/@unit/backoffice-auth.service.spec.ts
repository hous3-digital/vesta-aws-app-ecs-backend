import { BadRequestException, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { hash } from "bcrypt";
import { BackofficeAuthService } from "@src/infra/auth/backoffice-auth.service";

const session = { userId: "bo_user", issuerId: "issuer-a", email: "user@example.com", name: "User" };

function makeService() {
  const prisma = {
    backofficeUser: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const jwt = {
    signAsync: jest.fn().mockResolvedValue("token"),
    verifyAsync: jest.fn(),
  };
  const env = {
    BACKOFFICE_JWT_EXPIRES_IN: "never",
    BACKOFFICE_JWT_SECRET: "test-secret",
    ADMIN_SECRET: "admin-secret",
  };
  return {
    prisma,
    jwt,
    service: new BackofficeAuthService(prisma as never, jwt as unknown as JwtService, env as never),
  };
}

describe("BackofficeAuthService password change", () => {
  it("embeds the current auth version in a new login token", async () => {
    const { jwt, prisma, service } = makeService();
    prisma.backofficeUser.findFirst.mockResolvedValue({
      ...session,
      id: session.userId,
      passwordHash: await hash("Temporary1!", 4),
      authVersion: 3,
    });

    await service.login(session.email, "Temporary1!");

    expect(jwt.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ authVersion: 3, issuerId: session.issuerId }),
      expect.any(Object),
    );
  });

  it("changes the password and increments the auth version", async () => {
    const { prisma, service } = makeService();
    const passwordHash = await hash("Temporary1!", 4);
    prisma.backofficeUser.findFirst.mockResolvedValue({ passwordHash, authVersion: 2 });
    prisma.backofficeUser.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.changePassword(session, "Temporary1!", "PermanentPassword2!"))
      .resolves.toEqual({ changed: true });
    expect(prisma.backofficeUser.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ authVersion: 2, id: session.userId, issuerId: session.issuerId }),
      data: expect.objectContaining({ authVersion: { increment: 1 }, passwordHash: expect.any(String) }),
    }));
  });

  it("rejects an incorrect current password", async () => {
    const { prisma, service } = makeService();
    prisma.backofficeUser.findFirst.mockResolvedValue({ passwordHash: await hash("Temporary1!", 4), authVersion: 0 });

    await expect(service.changePassword(session, "WrongPassword1!", "PermanentPassword2!"))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.backofficeUser.updateMany).not.toHaveBeenCalled();
  });

  it("rejects weak and unchanged passwords", async () => {
    const { prisma, service } = makeService();
    await expect(service.changePassword(session, "Temporary1!", "too-weak"))
      .rejects.toBeInstanceOf(BadRequestException);

    prisma.backofficeUser.findFirst.mockResolvedValue({ passwordHash: await hash("TemporaryPassword1!", 4), authVersion: 0 });
    await expect(service.changePassword(session, "TemporaryPassword1!", "TemporaryPassword1!"))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects JWTs issued before the password auth version changed", async () => {
    const { jwt, prisma, service } = makeService();
    jwt.verifyAsync.mockResolvedValue({ sub: session.userId, issuerId: session.issuerId, email: session.email, name: session.name, authVersion: 1 });
    prisma.backofficeUser.findFirst.mockResolvedValue({ id: session.userId, issuerId: session.issuerId, email: session.email, name: session.name, authVersion: 2 });

    await expect(service.verifyBearer("old-token")).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("accepts legacy versionless JWTs until the first password change", async () => {
    const { jwt, prisma, service } = makeService();
    jwt.verifyAsync.mockResolvedValue({ sub: session.userId, issuerId: session.issuerId, email: session.email, name: session.name });
    prisma.backofficeUser.findFirst.mockResolvedValue({ id: session.userId, issuerId: session.issuerId, email: session.email, name: session.name, authVersion: 0 });

    await expect(service.verifyBearer("legacy-token")).resolves.toEqual(session);
  });
});
