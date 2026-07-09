import { BadRequestException, Body, ConflictException, Controller, NotFoundException, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { hash } from "bcrypt";
import { randomBytes } from "crypto";
import { AdminSecret } from "@src/infra/auth/admin-secret.guard";
import { PublicEndpoint } from "@src/infra/auth/public.decorator";
import { PrismaService } from "@src/infra/database/@prisma/prisma.service";

interface CreateIssuerBody {
  issuerId?: string;
  name: string;
  publicKey?: string;
  privyEnabled?: boolean;
}

interface CreateBackofficeUserBody {
  email: string;
  issuerId: string;
  name?: string;
  password?: string;
}

@ApiTags("admin")
@Controller("/admin")
@PublicEndpoint()
@AdminSecret()
export class AdminIssuersController {
  public constructor(private readonly prisma: PrismaService) {}

  @ApiOperation({ summary: "Cria um issuer" })
  @Post("/issuers")
  public async createIssuer(@Body() body: CreateIssuerBody) {
    const name = body.name?.trim();
    const providedIssuerId = body.issuerId?.trim();

    if (!name) {
      throw new BadRequestException("name and issuerId/name are required");
    }

    const issuerId = providedIssuerId || this.slugify(name);
    if (!issuerId) {
      throw new BadRequestException("issuerId could not be generated from name");
    }

    const existingIssuer = await this.prisma.issuer.findUnique({
      where: { issuerId },
      select: { id: true },
    });
    if (existingIssuer) throw new ConflictException("Issuer already exists");

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

    return {
      id: issuer.id,
      issuerId: issuer.issuerId,
      name: issuer.name,
      status: issuer.status,
      privyEnabled: issuer.privyEnabled,
      createdAt: issuer.createdAt,
    };
  }

  @ApiOperation({ summary: "Cria um acesso de backoffice para issuer existente" })
  @Post("/backoffice-users")
  public async createBackofficeUser(@Body() body: CreateBackofficeUserBody) {
    const issuerId = body.issuerId?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password?.trim() || this.generateTemporaryPassword();

    if (!issuerId || !email) {
      throw new BadRequestException("issuerId and email are required");
    }

    const [issuer, existingUser] = await Promise.all([
      this.prisma.issuer.findUnique({
        where: { issuerId },
        select: { issuerId: true, name: true },
      }),
      this.prisma.backofficeUser.findUnique({ where: { email }, select: { id: true } }),
    ]);

    if (!issuer) throw new NotFoundException("Issuer not found");
    if (existingUser) throw new ConflictException("Backoffice user already exists");

    const now = new Date();
    const user = await this.prisma.backofficeUser.create({
      data: {
        id: `bo_${randomBytes(12).toString("hex")}`,
        issuerId,
        email,
        passwordHash: await hash(password, 10),
        name: body.name?.trim() || issuer.name,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
      select: { id: true, issuerId: true, email: true, name: true, createdAt: true },
    });

    return {
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
