import { Injectable } from "@nestjs/common";
import { PrismaService } from "@src/infra/database/@prisma/prisma.service";
import { Id } from "@src/shared/value-objects/id.value-object";

@Injectable()
export class MembershipDataAccessObject {
  public constructor(private readonly prismaService: PrismaService) {}

  public async search(userId: Id) {
    const memberships = await this.prismaService.membership.findMany({
      where: { isActive: true, userId: userId.value },
      include: {
        role: { select: { type: true } },
        user: { select: { name: true, email: true } },
      },
    });

    return memberships.map((membership) => ({
      membershipId: membership.id,
      roleName: membership.role.type,
      userName: membership.user.name,
      userEmail: membership.user.email,
    }));
  }
}
