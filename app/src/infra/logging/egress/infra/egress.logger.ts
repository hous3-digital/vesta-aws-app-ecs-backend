import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@src/infra/database/@prisma/prisma.service";
import { typeid } from "typeid-js";

export type EgressRequest = {
  method: string;
  protocol: string;
  host: string;
  path: string;
};

export type EgressResponse = {
  status: number;
  data?: unknown;
};

@Injectable()
export class EgressLogger {
  public constructor(private readonly prisma: PrismaService) {}

  public async log(request: EgressRequest, response: EgressResponse): Promise<void> {
    const id = typeid("egress").toString();
    const now = new Date();

    await this.prisma.egress.create({
      data: {
        id: id,
        request: structuredClone(request) as Prisma.InputJsonValue,
        response: structuredClone(response) as Prisma.InputJsonValue,
        createdAt: now,
      },
    });
  }
}
