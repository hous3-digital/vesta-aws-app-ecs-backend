import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import type { JwtSignOptions } from "@nestjs/jwt";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "@src/infra/database/@prisma/prisma.service";
import { EnvService } from "@src/infra/env/env.service";
import type { BackofficeSession } from "@src/infra/auth/auth.types";
import * as bcrypt from "bcrypt";

interface BackofficeJwtPayload {
  sub: string;
  issuerId: string;
  email: string;
  name: string | null;
  authVersion?: number;
}

const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_BYTES = 72;
const PASSWORD_BCRYPT_ROUNDS = 12;

@Injectable()
export class BackofficeAuthService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly envService: EnvService,
  ) {}

  public async login(email: string, password: string): Promise<{
    accessToken: string;
    tokenType: "Bearer";
    expiresIn: number;
    user: BackofficeSession;
  }> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.backofficeUser.findFirst({
      where: { email: normalizedEmail, active: true },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid backoffice credentials");
    }

    const session: BackofficeSession = {
      userId: user.id,
      issuerId: user.issuerId,
      email: user.email,
      name: user.name,
    };

    return {
      accessToken: await this.sign(session, user.authVersion),
      tokenType: "Bearer",
      expiresIn: this.getExpiresInSeconds(),
      user: session,
    };
  }

  public async verifyBearer(token: string): Promise<BackofficeSession> {
    const secret = this.getSecret();
    const payload = await this.verifyToken(token, secret);
    const user = await this.prisma.backofficeUser.findFirst({
      where: { id: payload.sub, issuerId: payload.issuerId, active: true },
      select: { id: true, issuerId: true, email: true, name: true, authVersion: true },
    });

    if (!user || (payload.authVersion ?? 0) !== user.authVersion) {
      throw new UnauthorizedException("Backoffice user not found or inactive");
    }

    return {
      userId: user.id,
      issuerId: user.issuerId,
      email: user.email,
      name: user.name,
    };
  }

  public async changePassword(
    session: BackofficeSession,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ changed: true }> {
    this.validateNewPassword(newPassword);
    const user = await this.prisma.backofficeUser.findFirst({
      where: { id: session.userId, issuerId: session.issuerId, active: true },
      select: { passwordHash: true, authVersion: true },
    });

    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new ForbiddenException("Current password is incorrect");
    }
    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      throw new BadRequestException("New password must be different from the current password");
    }

    const updated = await this.prisma.backofficeUser.updateMany({
      where: { id: session.userId, issuerId: session.issuerId, active: true, authVersion: user.authVersion },
      data: {
        passwordHash: await bcrypt.hash(newPassword, PASSWORD_BCRYPT_ROUNDS),
        authVersion: { increment: 1 },
        updatedAt: new Date(),
      },
    });
    if (updated.count !== 1) throw new ConflictException("Password was changed by another session");

    return { changed: true };
  }

  private async sign(session: BackofficeSession, authVersion: number): Promise<string> {
    const expiresIn = this.envService.BACKOFFICE_JWT_EXPIRES_IN;
    const options: JwtSignOptions = {
      subject: session.userId,
      secret: this.getSecret(),
    };
    if (expiresIn !== "never") {
      options.expiresIn = expiresIn as JwtSignOptions["expiresIn"];
    }

    return this.jwtService.signAsync(
      {
        issuerId: session.issuerId,
        email: session.email,
        name: session.name,
        authVersion,
      },
      options,
    );
  }

  private validateNewPassword(password: string): void {
    const hasRequiredLength = password.length >= PASSWORD_MIN_LENGTH;
    const fitsBcryptLimit = Buffer.byteLength(password, "utf8") <= PASSWORD_MAX_BYTES;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);

    if (!hasRequiredLength || !fitsBcryptLimit || !hasUppercase || !hasLowercase || !hasNumber || !hasSymbol) {
      throw new BadRequestException(
        "New password must have 12 or more characters, including uppercase, lowercase, number and symbol, and must not exceed 72 bytes",
      );
    }
  }

  private async verifyToken(token: string, secret: string): Promise<BackofficeJwtPayload> {
    try {
      return await this.jwtService.verifyAsync<BackofficeJwtPayload>(token, { secret });
    } catch (cause) {
      if (isJwtExpiredError(cause)) {
        throw new UnauthorizedException("Backoffice session expired");
      }

      throw new UnauthorizedException("Invalid backoffice bearer token");
    }
  }

  private getSecret(): string {
    const secret = this.envService.BACKOFFICE_JWT_SECRET ?? this.envService.ADMIN_SECRET;
    if (!secret) throw new UnauthorizedException("BACKOFFICE_JWT_SECRET is not configured");
    return secret;
  }

  private getExpiresInSeconds(): number {
    const expiresIn = this.envService.BACKOFFICE_JWT_EXPIRES_IN;
    if (expiresIn === "never") return 0;
    if (/^\d+$/.test(expiresIn)) return Number(expiresIn);
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return 8 * 60 * 60;

    const value = Number(match[1]);
    const unit = match[2];
    if (unit === "s") return value;
    if (unit === "m") return value * 60;
    if (unit === "h") return value * 60 * 60;
    return value * 24 * 60 * 60;
  }
}

function isJwtExpiredError(cause: unknown): cause is { name: "TokenExpiredError" } {
  return typeof cause === "object" && cause !== null && "name" in cause && cause.name === "TokenExpiredError";
}
