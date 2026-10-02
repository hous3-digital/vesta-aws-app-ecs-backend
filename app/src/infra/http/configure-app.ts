import { ClassSerializerInterceptor, INestApplication, ValidationPipe } from "@nestjs/common";
import type { CorsOptions } from "@nestjs/common/interfaces/external/cors-options.interface";
import { Reflector } from "@nestjs/core";
import { ApiTransformInterceptor } from "@src/utils/interceptors/api-transform.interceptor";

export interface ConfigureAppOptions {
  /** CORS policy to enable; omitted means CORS stays off (production without an origin list). */
  cors?: CorsOptions;
}

/**
 * Global pipes, interceptors and CORS shared by main.ts and the e2e test app, so the contract the
 * tests lock is the one production serves. Static assets and Swagger stay in main.ts because they
 * depend on the environment.
 */
export function configureApp(app: INestApplication, options: ConfigureAppOptions = {}): void {
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)), new ApiTransformInterceptor());
  if (options.cors) app.enableCors(options.cors);
}
