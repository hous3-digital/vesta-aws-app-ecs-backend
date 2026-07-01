import type { Prisma } from "@src/infra/database/@prisma/generated/client";
import { Verifier as VerifierPrisma } from "@src/infra/database/@prisma/generated/client";
import { Verifier, VerifierStatus } from "@src/modules/backoffice/verifiers/domain/verifier.entity";

export class VerifierMapper {
  public static toDomain(prisma: VerifierPrisma): Verifier {
    return Verifier.restore({
      id: prisma.id,
      name: prisma.name,
      status: prisma.status as VerifierStatus,
      createdAt: prisma.createdAt,
      updatedAt: prisma.updatedAt,
    });
  }

  public static toCreateInput(domain: Verifier): Prisma.VerifierCreateInput {
    return {
      id: domain.id,
      name: domain.name,
      status: domain.status,
      createdAt: domain.createdAt,
      updatedAt: domain.updatedAt,
    };
  }

  public static toUpdateInput(domain: Verifier): Prisma.VerifierUpdateInput {
    return {
      name: domain.name,
      status: domain.status,
      updatedAt: domain.updatedAt,
    };
  }
}
