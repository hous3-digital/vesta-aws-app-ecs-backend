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
  exp?: number;
}

@Injectable()
export class BackofficeAuthService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly envService: EnvService,
  ) {}

  public async login(
    email: string,
    password: string,
  ): Promise<{
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
    const payload = await this.verifyToken(token, this.envService.BACKOFFICE_JWT_SECRET);
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
      secret: this.envService.BACKOFFICE_JWT_SECRET,
    };
    // "never" only reaches here with NODE_ENV=local: env.schema.ts refuses it everywhere else.
    if (expiresIn !== "never") {
      // jsonwebtoken reads a digit-only string as milliseconds; a number is seconds, as getExpiresInSeconds reports it.
      options.expiresIn = /^\d+$/.test(expiresIn) ? Number(expiresIn) : (expiresIn as JwtSignOptions["expiresIn"]);
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
    let payload: BackofficeJwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<BackofficeJwtPayload>(token, { secret });
    } catch (cause) {
      if (isJwtExpiredError(cause)) {
        throw new UnauthorizedException("Backoffice session expired");
      }

      throw new UnauthorizedException("Invalid backoffice bearer token");
    }

    // A token signed under BACKOFFICE_JWT_EXPIRES_IN=never carries no exp; only local may still present one (env.schema.ts).
    if (typeof payload.exp !== "number" && this.envService.NODE_ENV !== "local") {
      throw new UnauthorizedException("Backoffice session expired");
    }

    return payload;
  }

  private getExpiresInSeconds(): number {
    const expiresIn = this.envService.BACKOFFICE_JWT_EXPIRES_IN;
    if (expiresIn === "never") return 0;
    if (/^\d+$/.test(expiresIn)) return Number(expiresIn);
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) throw new Error("BACKOFFICE_JWT_EXPIRES_IN has a format env.schema.ts should have refused");

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
