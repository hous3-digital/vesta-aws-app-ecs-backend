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
    let maskedUrl: string;
    try {
      const parsed = new URL(dbUrl);
      if (parsed.password) parsed.password = "****";
      maskedUrl = parsed.toString();
    } catch {
      maskedUrl = "(URL inválida)";
    }

    // SSL é exigido pelo RDS (parameter group com rds.force_ssl=1). O adapter
    // @prisma/adapter-pg NÃO honra o `?sslmode=require` da connection string —
    // é preciso passar `ssl:` explicitamente. `rejectUnauthorized: false`
    // aceita o cert do RDS sem validar contra CA (suficiente pra trafego
    // interno na VPC). Em local/dev (Postgres sem SSL) mantemos undefined.
    const requiresSsl = envService.IS_PRODUCTION || envService.IS_TEST;

    console.log(`[PrismaService] Inicializando com DATABASE_URL=${maskedUrl} (ssl=${requiresSsl})`);

    super({
      adapter: new PrismaPg({
        connectionString: dbUrl,
        ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
      }),
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

    if (!this.envService.IS_PRODUCTION) {
      (this as any).$on("query", (e: Prisma.QueryEvent) => {
        console.log(`${GREEN}prisma:query${RESET}: ${e.query}`);
        console.log(`${GREEN}duration${RESET}: ${e.duration}ms\n`);
      });
    }
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
