import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@src/infra/database/@prisma/prisma.service";

@Injectable()
export class UserDataAccessObject {
  public constructor(private readonly prismaService: PrismaService) {}

  public async search(searchQuery?: string, pageNumber: number = 1, pageSize: number = 5) {
    const where = this.buildWhere(searchQuery);

    const totalRecords = await this.prismaService.user.count({
      where: where,
    });

    const skip = (pageNumber - 1) * pageSize;
    const take = pageSize;

    const users = await this.prismaService.user.findMany({
      where: where,
      skip: skip,
      take: take,
      orderBy: { createdAt: "desc" },
    });

    const totalPages = Math.ceil(totalRecords / pageSize);

    return {
      users: users,
      totalPages: totalPages,
      totalRecords: totalRecords,
      pageNumber: pageNumber,
      pageSize: pageSize,
    };
  }

  private buildWhere(searchQuery?: string): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {
      OR: [
        { id: { contains: searchQuery, mode: "insensitive" as const } },
        { name: { contains: searchQuery, mode: "insensitive" as const } },
        { email: { contains: searchQuery, mode: "insensitive" as const } },
      ],
    };

    return where;
  }
}
