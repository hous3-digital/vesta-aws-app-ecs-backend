import { Body, ConflictException, Controller, Post, UnauthorizedException } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { hash } from "bcrypt";
import { randomBytes } from "crypto";
import { AdminSecret } from "@src/infra/auth/admin-secret.guard";
import { PublicEndpoint } from "@src/infra/auth/public.decorator";
import { PrismaService } from "@src/infra/database/@prisma/prisma.service";

interface CreateIssuerBody {
  email: string;
  issuerId?: string;
  name: string;
  userName?: string;
  password?: string;
  publicKey?: string;
  privyEnabled?: boolean;
}

@ApiTags("admin/issuers")
@Controller("/admin/issuers")
@PublicEndpoint()
@AdminSecret()
export class AdminIssuersController {
  public constructor(private readonly prisma: PrismaService) {}

  @ApiOperation({ summary: "Cria issuer e usuario inicial do backoffice" })
  @Post()
  public async create(@Body() body: CreateIssuerBody) {
    const email = body.email?.trim().toLowerCase();
    const name = body.name?.trim();
    const issuerId = body.issuerId?.trim() || this.slugify(name);
    const password = body.password?.trim() || this.generateTemporaryPassword();

    if (!email || !name || !issuerId) {
      throw new UnauthorizedException("email, name and issuerId/name are required");
    }

    const [existingIssuer, existingUser] = await Promise.all([
      this.prisma.issuer.findUnique({ where: { issuerId }, select: { id: true } }),
      this.prisma.backofficeUser.findUnique({ where: { email }, select: { id: true } }),
    ]);
    if (existingIssuer) throw new ConflictException("Issuer already exists");
    if (existingUser) throw new ConflictException("Backoffice user already exists");

    const now = new Date();
    const issuer = await this.prisma.issuer.create({
      data: {
        id: `issuer_${randomBytes(12).toString("hex")}`,
        issuerId,
        name,
        status: "active",
        publicKey: body.publicKey ?? null,
        privyEnabled: body.privyEnabled ?? false,
        createdAt: now,
      },
    });

    const user = await this.prisma.backofficeUser.create({
      data: {
        id: `bo_${randomBytes(12).toString("hex")}`,
        issuerId,
        email,
        passwordHash: await hash(password, 10),
        name: body.userName?.trim() || name,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
      select: { id: true, issuerId: true, email: true, name: true, createdAt: true },
    });

    return {
      issuer: {
        id: issuer.id,
        issuerId: issuer.issuerId,
        name: issuer.name,
        status: issuer.status,
        privyEnabled: issuer.privyEnabled,
        createdAt: issuer.createdAt,
      },
      backofficeUser: user,
      temporaryPassword: password,
    };
  }

  private slugify(value: string): string {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  private generateTemporaryPassword(): string {
    return `vesta_${randomBytes(12).toString("hex")}`;
  }
}
