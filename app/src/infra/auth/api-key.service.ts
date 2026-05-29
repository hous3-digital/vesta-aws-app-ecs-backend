import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@src/infra/database/@prisma/prisma.service";
import { randomBytes } from "crypto";

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  public constructor(private readonly prisma: PrismaService) {}

  public async validate(key: string): Promise<boolean> {
    const record = await this.prisma.apiKey.findFirst({
      where: { key, active: true },
      select: { id: true },
    });
    return !!record;
  }

  public async create(name: string): Promise<{ id: string; key: string; name: string; createdAt: Date }> {
    const id = `ak_${randomBytes(12).toString("hex")}`;
    const key = `vesta_live_${randomBytes(24).toString("hex")}`;

    const record = await this.prisma.apiKey.create({
      data: { id, key, name, active: true, createdAt: new Date() },
    });

    this.logger.log(`API key created: ${name} (${id})`);
    return { id: record.id, key: record.key, name: record.name, createdAt: record.createdAt };
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

  public async list(): Promise<{ id: string; name: string; active: boolean; createdAt: Date; revokedAt: Date | null }[]> {
    return this.prisma.apiKey.findMany({
      select: { id: true, name: true, active: true, createdAt: true, revokedAt: true },
      orderBy: { createdAt: "desc" },
    });
  }
}
