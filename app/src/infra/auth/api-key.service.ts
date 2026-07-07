import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@src/infra/database/@prisma/prisma.service";
import { randomBytes } from "crypto";

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  public constructor(private readonly prisma: PrismaService) {}

  public async resolve(key: string): Promise<{ apiKeyId: string; issuerId: string } | null> {
    const record = await this.prisma.apiKey.findFirst({
      where: { key, active: true, issuerId: { not: null } },
      select: { id: true, issuerId: true },
    });
    if (!record?.issuerId) return null;
    return { apiKeyId: record.id, issuerId: record.issuerId };
  }

  public async validate(key: string): Promise<boolean> {
    return !!(await this.resolve(key));
  }

  public async create(
    name: string,
    issuerId: string,
  ): Promise<{ id: string; key: string; name: string; issuerId: string; createdAt: Date }> {
    const id = `ak_${randomBytes(12).toString("hex")}`;
    const key = `vesta_live_${randomBytes(24).toString("hex")}`;

    const record = await this.prisma.apiKey.create({
      data: { id, key, name, issuerId, active: true, createdAt: new Date() },
    });

    this.logger.log(`API key created: ${name} (${id}) for issuer ${issuerId}`);
    return {
      id: record.id,
      key: record.key,
      name: record.name,
      issuerId: record.issuerId ?? issuerId,
      createdAt: record.createdAt,
    };
  }

  public async revoke(id: string): Promise<boolean> {
    const record = await this.prisma.apiKey.findFirst({ where: { id, active: true } });
    if (!record) return false;

    await this.prisma.apiKey.update({
      where: { id },
      data: { active: false, revokedAt: new Date() },
    });

    this.logger.log(`API key revoked: ${record.name} (${id})`);
    return true;
  }

  public async revokeForIssuer(id: string, issuerId: string): Promise<boolean> {
    const record = await this.prisma.apiKey.findFirst({ where: { id, issuerId, active: true } });
    if (!record) return false;

    await this.prisma.apiKey.update({
      where: { id },
      data: { active: false, revokedAt: new Date() },
    });

    this.logger.log(`API key revoked: ${record.name} (${id}) for issuer ${issuerId}`);
    return true;
  }

  public async list(
    issuerId?: string,
  ): Promise<{ id: string; issuerId: string | null; name: string; active: boolean; createdAt: Date; revokedAt: Date | null }[]> {
    return this.prisma.apiKey.findMany({
      where: issuerId ? { issuerId } : undefined,
      select: { id: true, issuerId: true, name: true, active: true, createdAt: true, revokedAt: true },
      orderBy: { createdAt: "desc" },
    });
  }
}
