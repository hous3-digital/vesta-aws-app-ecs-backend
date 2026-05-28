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

const PII_FIELDS = new Set(["cpf", "fullName", "birthDate", "privateInputs"]);

function redactPii(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => redactPii(item, depth + 1));
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    result[key] = PII_FIELDS.has(key) ? "[REDACTED]" : redactPii(val, depth + 1);
  }
  return result;
}

@Injectable()
export class IngressLogger {
  public constructor(private readonly prisma: PrismaService) {}

  public async log(request: IngressRequest, response: IngressResponse): Promise<void> {
    const id = Id.create("ingress").value;
    const now = new Date();

    const sanitizedRequest = redactPii(structuredClone(request));

    await this.prisma.ingress.create({
      data: {
        id: id,
        request: sanitizedRequest as Prisma.InputJsonValue,
        response: structuredClone(response) as unknown as Prisma.InputJsonValue,
        createdAt: now,
      },
    });
  }
}
