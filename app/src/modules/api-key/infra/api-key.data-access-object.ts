import { Injectable } from "@nestjs/common";
import type { Prisma } from "@src/infra/database/@prisma/generated/client";
import { PrismaService } from "@src/infra/database/@prisma/prisma.service";

/** Listing shape: neither the clear key nor its hash ever leaves the database through a list. */
const LIST_SELECT = {
  id: true,
  issuerId: true,
  name: true,
  keyPrefix: true,
  active: true,
  createdAt: true,
  revokedAt: true,
  expiresAt: true,
} satisfies Prisma.ApiKeySelect;

@Injectable()
export class ApiKeyDataAccessObject {
  public constructor(private readonly prismaService: PrismaService) {}

  public async listAll() {
    return this.prismaService.apiKey.findMany({ select: LIST_SELECT, orderBy: { createdAt: "desc" } });
  }

  public async listByIssuer(issuerId: string) {
    return this.prismaService.apiKey.findMany({
      where: { issuerId },
      select: LIST_SELECT,
      orderBy: { createdAt: "desc" },
    });
  }
}
