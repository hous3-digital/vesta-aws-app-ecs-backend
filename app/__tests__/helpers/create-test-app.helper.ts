import { ClassSerializerInterceptor, INestApplication, ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { AppModule } from "@src/app.module";
import { PrismaService } from "@src/infra/database/@prisma/prisma.service";
import { ApiTransformInterceptor } from "@src/utils/interceptors/api-transform.interceptor";

export interface TestApp {
  app: INestApplication;
  prisma: PrismaService;
  close: () => Promise<void>;
}

/**
 * Boots the real AppModule with the same pipes and interceptors as main.ts,
 * against the database in .env.test. One call per spec file, in beforeAll.
 */
export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)), new ApiTransformInterceptor());
  await app.init();

  const prisma = app.get(PrismaService);
  return { app, prisma, close: () => app.close() };
}
