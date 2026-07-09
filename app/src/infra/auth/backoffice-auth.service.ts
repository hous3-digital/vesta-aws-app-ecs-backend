import { Injectable, UnauthorizedException } from "@nestjs/common";
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
}

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
      accessToken: await this.sign(session),
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
      select: { id: true, issuerId: true, email: true, name: true },
    });

    if (!user) {
      throw new UnauthorizedException("Backoffice user not found or inactive");
    }

    return {
      userId: user.id,
      issuerId: user.issuerId,
      email: user.email,
      name: user.name,
    };
  }

  private async sign(session: BackofficeSession): Promise<string> {
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
      },
      options,
    );
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
