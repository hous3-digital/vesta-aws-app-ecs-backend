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

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
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

  const envService = app.get<EnvService>(EnvService);

  const config = new DocumentBuilder()
    .setTitle("Vesta SDK API")
    .setDescription("API para integração com os SDKs Vesta")
    .setVersion("1.0")
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup("docs", app, document);
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  const interceptors = [new ClassSerializerInterceptor(app.get(Reflector)), new ApiTransformInterceptor()];

  app.useGlobalInterceptors(...interceptors);

  app.enableCors();

  app.useStaticAssets(join(process.cwd(), "dist", "public"), { prefix: "/public" });
  app.setBaseViewsDir(join(process.cwd(), "dist"));
  app.setViewEngine("hbs");
  app.enableShutdownHooks();

  await app.listen(envService.PORT, "0.0.0.0");
}

bootstrap();
