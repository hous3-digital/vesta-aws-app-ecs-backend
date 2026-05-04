import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@src/infra/database/@prisma/prisma.service";
import { Id } from "@src/shared/value-objects/id.value-object";

export interface IngressRequest {
  ip: string | string[] | undefined;
  method: string;
  protocol: string;
  host: string;
  path: string;
  body?: unknown;
}

export interface IngressResponse {
  status?: number;
}

@Injectable()
export class IngressLogger {
  public constructor(private readonly prisma: PrismaService) {}

  public async log(request: IngressRequest, response: IngressResponse): Promise<void> {
    const id = Id.create("ingress").value;
    const now = new Date();

    await this.prisma.ingress.create({
      data: {
        id: id,
        request: structuredClone(request) as unknown as Prisma.InputJsonValue,
        response: structuredClone(response) as unknown as Prisma.InputJsonValue,
        createdAt: now,
      },
    });
  }
}
