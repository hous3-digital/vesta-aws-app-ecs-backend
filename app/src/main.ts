import { ClassSerializerInterceptor, ValidationPipe } from "@nestjs/common";
import { NestFactory, Reflector } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "@src/app.module";
import { EnvService } from "@src/infra/env/env.service";
import { ApiTransformInterceptor } from "@src/utils/interceptors/api-transform.interceptor";
import { WinstonModule, utilities as nestWinstonModuleUtilities } from "nest-winston";
import { join } from "path";
import * as winston from "winston";

function maskUrl(url: string | undefined): string {
  if (!url) return "(não definida)";
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = "****";
    return parsed.toString();
  } catch {
    return "(URL inválida)";
  }
}

process.on("uncaughtException", (err) => {
  console.error("[STARTUP] uncaughtException:", err.message);
  console.error(err.stack);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("[STARTUP] unhandledRejection:", reason);
  process.exit(1);
});

async function bootstrap() {
  console.log("[STARTUP] Iniciando bootstrap...");
  console.log(`[STARTUP] NODE_ENV=${process.env.NODE_ENV ?? "(não definida)"}`);
  console.log(`[STARTUP] PORT=${process.env.PORT ?? "(não definida)"}`);
  console.log(`[STARTUP] DATABASE_URL=${maskUrl(process.env.DATABASE_URL)}`);
  console.log(`[STARTUP] STELLAR_RPC_URL=${process.env.STELLAR_RPC_URL ?? "(não definida)"}`);
  console.log(`[STARTUP] VESTA_CONTRACT_ID=${process.env.VESTA_CONTRACT_ID ?? "(não definida)"}`);
  console.log(`[STARTUP] ZK_MOCK_MODE=${process.env.ZK_MOCK_MODE ?? "(não definida)"}`);
  console.log(`[STARTUP] ZK_ARTIFACTS_DIR=${process.env.ZK_ARTIFACTS_DIR ?? "(não definida)"}`);
  console.log(`[STARTUP] cwd=${process.cwd()}`);

  let app: NestExpressApplication;

  try {
    console.log("[STARTUP] Criando aplicação NestJS (inicializando módulos)...");
    app = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: WinstonModule.createLogger({
        transports: [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.ms(),
              winston.format.errors({ stack: true }),
              nestWinstonModuleUtilities.format.nestLike(),
            ),
          }),
        ],
      }),
    });
    console.log("[STARTUP] Módulos inicializados com sucesso.");
  } catch (err) {
    console.error("[STARTUP] Falha ao inicializar módulos NestJS:", (err as Error).message);
    console.error((err as Error).stack);
    process.exit(1);
  }

  const envService = app.get<EnvService>(EnvService);
  console.log(`[STARTUP] EnvService carregado — PORT=${envService.PORT}, NODE_ENV=${envService.NODE_ENV}`);

  const config = new DocumentBuilder()
    .setTitle("Vesta SDK API")
    .setDescription("API para integração com os SDKs Vesta")
    .setVersion("1.0")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document);

  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)), new ApiTransformInterceptor());
  app.enableCors();
  app.useStaticAssets(join(process.cwd(), "dist", "public"), { prefix: "/public" });
  app.setBaseViewsDir(join(process.cwd(), "dist"));
  app.setViewEngine("hbs");
  app.enableShutdownHooks();

  const port = envService.PORT;
  console.log(`[STARTUP] Iniciando servidor HTTP na porta ${port} em 0.0.0.0...`);

  try {
    await app.listen(port, "0.0.0.0");
    console.log(`[STARTUP] Servidor ouvindo em http://0.0.0.0:${port}`);
    console.log(`[STARTUP] Swagger disponível em http://0.0.0.0:${port}/docs`);
  } catch (err) {
    console.error("[STARTUP] Falha ao iniciar servidor HTTP:", (err as Error).message);
    console.error((err as Error).stack);
    process.exit(1);
  }
}

bootstrap();
