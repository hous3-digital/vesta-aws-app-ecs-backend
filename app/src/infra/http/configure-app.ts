import { ClassSerializerInterceptor, INestApplication, ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ApiTransformInterceptor } from "@src/utils/interceptors/api-transform.interceptor";

/**
 * Global pipes and interceptors shared by main.ts and the e2e test app, so the contract the
 * tests lock is the one production serves. CORS, static assets and Swagger stay in main.ts
 * because they depend on the environment.
 */
export function configureApp(app: INestApplication): void {
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)), new ApiTransformInterceptor());
}
