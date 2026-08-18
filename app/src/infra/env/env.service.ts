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

  public get ADMIN_SECRET() {
    return this.configService.get("ADMIN_SECRET") as string | undefined;
  }

  public get BACKOFFICE_JWT_SECRET() {
    return (this.configService.get("BACKOFFICE_JWT_SECRET") ?? this.ADMIN_SECRET) as string | undefined;
  }

  public get BACKOFFICE_JWT_EXPIRES_IN() {
    return this.configService.get("BACKOFFICE_JWT_EXPIRES_IN") as string;
  }

  public get PRIVY_APP_ID() {
    return this.configService.get("PRIVY_APP_ID") as string | undefined;
  }

  public get PRIVY_APP_SECRET() {
    return this.configService.get("PRIVY_APP_SECRET") as string | undefined;
  }

  public get PRIVY_CUSTOM_AUTH_PRIVATE_KEY() {
    return this.configService.get("PRIVY_CUSTOM_AUTH_PRIVATE_KEY") as string | undefined;
  }

  public get PRIVY_CUSTOM_AUTH_KEY_ID() {
    return this.configService.get("PRIVY_CUSTOM_AUTH_KEY_ID") as string | undefined;
  }

  public get PRIVY_CUSTOM_AUTH_ISSUER() {
    return this.configService.get("PRIVY_CUSTOM_AUTH_ISSUER") as string;
  }

  public get WEBAUTHN_ALLOWED_ORIGINS() {
    return (this.configService.get("WEBAUTHN_ALLOWED_ORIGINS") ?? this.CORS_ALLOWED_ORIGINS) as string;
  }

  public get WEBAUTHN_ALLOWED_RP_IDS() {
    return this.configService.get("WEBAUTHN_ALLOWED_RP_IDS") as string;
  }

  public get COMMISSION_PER_VERIFICATION_BRL() {
    return this.configService.get("COMMISSION_PER_VERIFICATION_BRL") as number;
  }

  public get COMMISSION_SECURITY_MINUTES() {
    return this.configService.get("COMMISSION_SECURITY_MINUTES") as number;
  }

  public get STELLAR_PAYOUT_ASSET_CODE() {
    return this.configService.get("STELLAR_PAYOUT_ASSET_CODE") as string;
  }

  public get STELLAR_PAYOUT_ASSET_ISSUER() {
    return this.configService.get("STELLAR_PAYOUT_ASSET_ISSUER") as string | undefined;
  }
}
