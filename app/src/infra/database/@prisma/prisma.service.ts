import { INestApplication, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@src/infra/database/@prisma/generated/client";
import { EnvService } from "@src/infra/env/env.service";

const GREEN = "\x1b[32m";
const RESET = "\x1b[0m";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  public constructor(private readonly envService: EnvService) {
    const dbUrl = envService.DATABASE_URL;
    let maskedUrl = "(não definida)";
    try {
      const parsed = new URL(dbUrl);
      if (parsed.password) parsed.password = "****";
      maskedUrl = parsed.toString();
    } catch {
      maskedUrl = "(URL inválida)";
    }

    console.log(`[PrismaService] Inicializando com DATABASE_URL=${maskedUrl}`);

    super({
      adapter: new PrismaPg({ connectionString: dbUrl }),
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
    this.logger.log("Conectando ao banco de dados...");
    try {
      await this.$connect();
      this.logger.log("Conexão com banco de dados estabelecida com sucesso.");
    } catch (err) {
      this.logger.error(`Falha ao conectar ao banco de dados: ${(err as Error).message}`);
      this.logger.error((err as Error).stack ?? "");
      throw err;
    }

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
