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

  public get JWT_ACCESS_SECRET() {
    return this.configService.get("JWT_ACCESS_SECRET") as string;
  }

  public get VERIFF_BASE_URL() {
    return this.configService.get("VERIFF_BASE_URL") as string;
  }

  public get VERIFF_API_KEY() {
    return this.configService.get("VERIFF_API_KEY") as string;
  }

  public get VERIFF_SECRET_KEY() {
    return this.configService.get("VERIFF_SECRET_KEY") as string;
  }

  public get AWS_S3_PUBLIC_BUCKET() {
    return this.configService.get("AWS_S3_PUBLIC_BUCKET") as string;
  }

  public get AWS_S3_PRIVATE_BUCKET() {
    return this.configService.get("AWS_S3_PRIVATE_BUCKET") as string;
  }

  public get AWS_REGION() {
    return this.configService.get("AWS_REGION") as string;
  }

  public get AWS_IAM_ACCESS_KEY_ID() {
    return this.configService.get("AWS_IAM_ACCESS_KEY_ID") as string;
  }

  public get AWS_IAM_SECRET_ACCESS_KEY() {
    return this.configService.get("AWS_IAM_SECRET_ACCESS_KEY") as string;
  }
}
