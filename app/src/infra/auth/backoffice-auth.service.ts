import { Injectable, UnauthorizedException } from "@nestjs/common";
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
      expiresIn: 8 * 60 * 60,
      user: session,
    };
  }

  public async verifyBearer(token: string): Promise<BackofficeSession> {
    const secret = this.getSecret();
    const payload = await this.jwtService.verifyAsync<BackofficeJwtPayload>(token, { secret });
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
    return this.jwtService.signAsync(
      {
        issuerId: session.issuerId,
        email: session.email,
        name: session.name,
      },
      {
        subject: session.userId,
        secret: this.getSecret(),
        expiresIn: "8h",
      },
    );
  }

  private getSecret(): string {
    const secret = this.envService.BACKOFFICE_JWT_SECRET ?? this.envService.ADMIN_SECRET;
    if (!secret) throw new UnauthorizedException("BACKOFFICE_JWT_SECRET is not configured");
    return secret;
  }
}
