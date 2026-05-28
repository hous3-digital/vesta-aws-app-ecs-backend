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

  public get STELLAR_RPC_URL() {
    return this.configService.get("STELLAR_RPC_URL") as string;
  }

  public get STELLAR_NETWORK() {
    return this.configService.get("STELLAR_NETWORK") as string;
  }

  public get VESTA_CONTRACT_ID() {
    return this.configService.get("VESTA_CONTRACT_ID") as string;
  }

  public get VESTA_DEPLOYER_SECRET() {
    return this.configService.get("VESTA_DEPLOYER_SECRET") as string;
  }

  public get ZK_ARTIFACTS_DIR() {
    return this.configService.get("ZK_ARTIFACTS_DIR") as string;
  }

  public get ZK_MOCK_MODE() {
    return this.configService.get("ZK_MOCK_MODE") as boolean;
  }

  public get CPF_HMAC_SECRET() {
    return this.configService.get("CPF_HMAC_SECRET") as string;
  }

  public get CORS_ALLOWED_ORIGINS() {
    return this.configService.get("CORS_ALLOWED_ORIGINS") as string;
  }

  public get REDIS_URL() {
    return this.configService.get("REDIS_URL") as string | undefined;
  }
}
