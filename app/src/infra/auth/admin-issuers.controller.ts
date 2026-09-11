import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Logger,
  NotFoundException,
  Param,
  Post,
  Put,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { hash } from "bcrypt";
import { randomBytes } from "crypto";
import { AdminSecret } from "@src/infra/auth/admin-secret.guard";
import { PublicEndpoint } from "@src/infra/auth/public.decorator";
import { PrismaService } from "@src/infra/database/@prisma/prisma.service";
import { WalletService } from "@src/modules/wallet/wallet.service";
import { IssuerDid } from "@src/modules/issuer/domain/issuer-did.value-object";
import type { IssuerRole } from "@src/modules/issuer/domain/issuer.entity";
import { IssuerRegistryService } from "@src/modules/issuer/issuer-registry.service";

const ISSUER_ROLES: readonly IssuerRole[] = ["TECHNICAL", "COMMERCIAL"];

interface CreateIssuerBody {
  issuerId?: string;
  name: string;
  publicKey?: string;
  privyEnabled?: boolean;
  roles: IssuerRole[];
  authorizedCredentialTypes?: string[];
}

interface CreateBackofficeUserBody {
  email: string;
  issuerId: string;
  name?: string;
  password?: string;
}

interface RegisterIssuerBody {
  commissionTerms: unknown;
}

@ApiTags("admin")
@Controller("/admin")
@PublicEndpoint()
@AdminSecret()
export class AdminIssuersController {
  private readonly logger = new Logger(AdminIssuersController.name);

  public constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly issuerRegistryService: IssuerRegistryService,
  ) {}

  @ApiOperation({ summary: "Cria um issuer" })
  @Post("/issuers")
  public async createIssuer(@Body() body: CreateIssuerBody) {
    const name = body.name?.trim();
    const providedIssuerId = body.issuerId?.trim();
    const roles = this.parseRoles(body.roles);
    const authorizedCredentialTypes = this.parseCredentialTypes(body.authorizedCredentialTypes);

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
        roles,
        authorizedCredentialTypes,
        registryStatus: "UNREGISTERED",
        createdAt: now,
      },
    });

    const organizationWallet = await this.walletService.provisionForOrganization(issuer.issuerId);
    const did = this.didFromOrganizationWallet(organizationWallet);
    if (!did) {
      this.logger.warn(`Issuer ${issuer.issuerId} criado sem DID; registry permanece UNREGISTERED`);
    }

    return {
      id: issuer.id,
      issuerId: issuer.issuerId,
      name: issuer.name,
      status: issuer.status,
      privyEnabled: issuer.privyEnabled,
      did: did?.value ?? null,
      roles: issuer.roles,
      authorizedCredentialTypes: issuer.authorizedCredentialTypes,
      registryStatus: issuer.registryStatus,
      createdAt: issuer.createdAt,
      organizationWallet,
    };
  }

  @ApiOperation({ summary: "Provisiona ou recupera a wallet Stellar organizacional do issuer" })
  @Post("/issuers/:issuerId/wallet")
  public async provisionOrganizationWallet(@Param("issuerId") issuerId: string) {
    return this.walletService.provisionForOrganization(issuerId);
  }

  @ApiOperation({ summary: "Registra ou atualiza o issuer no registry Soroban" })
  @Put("/issuers/:issuerId/registry")
  public async registerIssuer(@Param("issuerId") issuerId: string, @Body() body: RegisterIssuerBody) {
    return this.issuerRegistryService.registerOrUpdate(issuerId, body?.commissionTerms);
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

  private parseRoles(value: unknown): IssuerRole[] {
    if (!Array.isArray(value) || value.length === 0) {
      throw new BadRequestException("roles must contain TECHNICAL, COMMERCIAL, or both");
    }
    if (value.some((role) => typeof role !== "string" || !ISSUER_ROLES.includes(role as IssuerRole))) {
      throw new BadRequestException("roles contains an unsupported issuer role");
    }
    return [...new Set(value as IssuerRole[])];
  }

  private parseCredentialTypes(value: unknown): string[] {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.some((type) => typeof type !== "string" || !type.trim())) {
      throw new BadRequestException("authorizedCredentialTypes must contain non-empty strings");
    }
    return [...new Set(value.map((type) => (type as string).trim()))];
  }

  private didFromOrganizationWallet(wallet: { address: string | null; network: string }): IssuerDid | null {
    if (!wallet.address || (wallet.network !== "testnet" && wallet.network !== "mainnet")) return null;
    try {
      return IssuerDid.fromStellarAccount(wallet.address, wallet.network);
    } catch (cause) {
      this.logger.warn(`Wallet organizacional nao produziu um DID valido: ${(cause as Error).message}`);
      return null;
    }
  }

  private generateTemporaryPassword(): string {
    return `vesta_${randomBytes(12).toString("hex")}`;
  }
}
