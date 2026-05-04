import { INestApplication, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@src/infra/database/@prisma/generated/client";
import { EnvService } from "@src/infra/env/env.service";

const GREEN = "\x1b[32m";
const RESET = "\x1b[0m";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  public constructor(private readonly envService: EnvService) {
    super({
      adapter: new PrismaPg({ connectionString: envService.DATABASE_URL }),
      log:
        envService.IS_PRODUCTION || envService.IS_TEST
          ? undefined
          : [
              { emit: "event", level: "query" },
              { emit: "stdout", level: "info" },
              { emit: "stdout", level: "warn" },
              { emit: "stdout", level: "error" },
            ],
    });
  }

  public async onModuleInit(): Promise<void> {
    await this.$connect();

    (this as any).$on("query", (e: Prisma.QueryEvent) => {
      const params = JSON.parse(e.params);
      let query = e.query;

      params.forEach((param: unknown, index: number) => {
        query = query.replace(`$${index + 1}`, typeof param === "string" ? `'${param}'` : String(param));
      });

      console.log(`${GREEN}prisma:query${RESET}: ${query}`);
      console.log(`${GREEN}duration${RESET}: ${e.duration}ms\n`);
    });
  }

  public async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  public enableShutdownHooks(app: INestApplication): void {
    (this as any).$on("beforeExit", async () => {
      await app.close();
    });
  }
}
