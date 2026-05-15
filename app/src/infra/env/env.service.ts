import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class EnvService {
  public constructor(private readonly configService: ConfigService) {}

  public get IS_PRODUCTION() {
    return this.configService.get("NODE_ENV") === "production";
  }

  public get IS_TEST() {
    return this.configService.get("NODE_ENV") === "test";
  }

  public get NODE_ENV() {
    return this.configService.get("NODE_ENV") as "local" | "test" | "development" | "production";
  }

  public get PORT() {
    return this.configService.get("PORT") as number;
  }

  public get DATABASE_URL() {
    return this.configService.get("DATABASE_URL") as string;
  }
}
