import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "@src/app.module";
import { PrismaService } from "@src/infra/database/@prisma/prisma.service";
import { configureApp } from "@src/infra/http/configure-app";

export interface TestApp {
  app: INestApplication;
  prisma: PrismaService;
  close: () => Promise<void>;
}

/**
 * Boots the real AppModule through the same configureApp() as main.ts,
 * against the database in .env.test. One call per spec file, in beforeAll.
 */
export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });

  configureApp(app);
  await app.init();

  const prisma = app.get(PrismaService);
  return { app, prisma, close: () => closeApp(app) };
}

/**
 * snarkjs keeps a bn128 thread pool alive after groth16.verify (used by /public/proof/prepare)
 * and only exposes it as a global; without terminate() jest never exits after a proof spec.
 */
async function closeApp(app: INestApplication): Promise<void> {
  await app.close();
  const curve = (globalThis as { curve_bn128?: { terminate: () => Promise<void> } }).curve_bn128;
  if (curve) await curve.terminate();
}
