import { BadRequestException, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { EnvService } from "@src/infra/env/env.service";
import { PrismaService } from "@src/infra/database/@prisma/prisma.service";
import { IIssuerRepository } from "@src/modules/issuer/domain/issuer.repository";
import { StellarService } from "@src/modules/stellar/stellar.service";
// Privy server SDK — instalado via @privy-io/server-auth
import { PrivyClient } from "@privy-io/server-auth";
import { Id } from "@src/shared/value-objects/id.value-object";
import { JwtService } from "@nestjs/jwt";
import { Keypair } from "@stellar/stellar-sdk";
import { createPublicKey } from "node:crypto";

export interface CustomAuthJwks {
  keys: Array<{
    alg: "ES256";
    crv: "P-256";
    kid: string;
    kty: "EC";
    use: "sig";
    x: string;
    y: string;
  }>;
}

export interface PrecreateWalletResult {
  privyUserId: string;
  privyWalletId: string | null;
  stellarAddress: string;
}

export interface PrivyIdentityClaims {
  userId: string;
  walletAddress: string;
}

/**
 * Shape minimo de um wallet dentro de `user.linkedAccounts`.
 * A tipagem exportada pelo Privy (`WalletWithMetadata`) muda entre versoes,
 * mas o formato interno estabiliza estas propriedades. Filtramos aqui em vez de
 * depender do tipo publico do SDK para ficar imune a bumps menores.
 */
interface PrivyLinkedWallet {
  id?: string;
  type: "wallet";
  address: string;
  chainType?: string;
  walletClientType?: string;
}

/**
 * Payload que o `importUser` do @privy-io/server-auth 1.x aceita para gerar
 * um usuario ja com wallet Stellar pre-criada. A tipagem publica ainda esta em
 * flux para Stellar (Tier 2), entao definimos localmente para nao cair em `any`.
 */
interface PrivyImportUserInput {
  customMetadata?: Record<string, string>;
  linkedAccounts: Array<{
    type: "custom_auth";
    customUserId: string;
  }>;
  wallets?: Array<{
    chainType: "stellar" | "ethereum" | "solana";
  }>;
}

interface PrivyUser {
  id: string;
  linkedAccounts?: Array<Record<string, unknown>>;
}

// Interface minima do PrivyClient que usamos. Isola pontos onde a tipagem
// oficial diverge e mantem type-check honesto no consumidor.
interface PrivyClientLike {
  importUser: (input: PrivyImportUserInput) => Promise<PrivyUser>;
  verifyAuthToken: (token: string) => Promise<{ userId: string }>;
  getUser: (userId: string) => Promise<PrivyUser | null>;
}

@Injectable()
export class WalletService implements OnModuleInit {
  private readonly logger = new Logger(WalletService.name);
  private client: PrivyClient | null = null;
  private enabled = false;
  private customAuthJwks: CustomAuthJwks | null = null;

  public constructor(
    private readonly envService: EnvService,
    private readonly prisma: PrismaService,
    private readonly issuerRepository: IIssuerRepository,
    private readonly stellarService: StellarService,
    private readonly jwtService: JwtService = new JwtService(),
  ) {}

  public onModuleInit(): void {
    const appId = this.envService.PRIVY_APP_ID;
    const appSecret = this.envService.PRIVY_APP_SECRET;

    if (!appId || !appSecret) {
      this.logger.warn(
        "WalletService desativado — PRIVY_APP_ID/PRIVY_APP_SECRET ausentes. " +
          "Fluxo Privy so funcionara apos configuracao.",
      );
      this.enabled = false;
      return;
    }

    this.client = new PrivyClient(appId, appSecret);
    this.enabled = true;
    this.logger.log(`Privy client inicializado — appId=${appId.slice(0, 8)}...`);
  }

  /**
   * Indica se a integracao Privy esta habilitada para o issuer informado.
   * Retorna false se o client Privy nao esta configurado OU se o issuer
   * nao tem o feature flag ativo no banco.
   */
  public async isEnabledForIssuer(externalIssuerId: string): Promise<boolean> {
    if (!this.enabled) {
      this.logger.debug(`isEnabledForIssuer(${externalIssuerId}) — client Privy desativado`);
      return false;
    }
    const issuer = await this.issuerRepository.findByExternalId(externalIssuerId);
    const flag = !!issuer?.privyEnabled;
    this.logger.debug(
      `isEnabledForIssuer(${externalIssuerId}) — privyEnabled=${flag} (issuer ${issuer ? "encontrado" : "nao encontrado"})`,
    );
    return flag;
  }

  /**
   * Pre-cria uma wallet Stellar Privy vinculada ao subjectDid da credencial.
   *
   * Chama `importUser` com `wallets: [{ chainType: 'stellar' }]` — este e o
   * parametro correto para pregerar embedded wallets em qualquer chain
   * suportado pelo Privy 1.x (a versao antiga do codigo usava
   * `createEmbeddedWallets: { stellar: true }`, que nao existe na API real).
   *
   * O `custom_auth` como linked account usa o subjectDid como chave externa —
   * chamadas repetidas com o mesmo subjectDid retornam o mesmo user (idempotencia).
   */
  public async precreateForCredential(params: {
    subjectDid: string;
    cpfDedupKey: string | null;
  }): Promise<PrecreateWalletResult> {
    if (!this.client) {
      throw new Error("WalletService.precreateForCredential chamado sem Privy configurado");
    }

    const client = this.client as unknown as PrivyClientLike;

    this.logger.log(`[Privy] importUser start — subjectDid=${params.subjectDid.slice(0, 24)}..., wallets=[stellar]`);

    const user = await client.importUser({
      customMetadata: {
        subjectDid: params.subjectDid,
        cpfDedupKey: params.cpfDedupKey ?? "",
      },
      linkedAccounts: [
        {
          type: "custom_auth",
          customUserId: params.subjectDid,
        },
      ],
      wallets: [{ chainType: "stellar" }],
    });

    this.logger.log(
      `[Privy] importUser ok — userId=${user.id}, linkedAccounts.length=${user.linkedAccounts?.length ?? 0}`,
    );

    const stellarWallet = this.findStellarWallet(user);

    if (!stellarWallet) {
      this.logger.error(
        `[Privy] user criado sem wallet Stellar em linkedAccounts — subjectDid=${params.subjectDid.slice(0, 24)}..., ` +
          `linkedAccounts=${JSON.stringify(user.linkedAccounts ?? [])}`,
      );
      throw new Error(`Privy nao retornou endereco Stellar para subjectDid ${params.subjectDid}`);
    }

    this.logger.log(
      `[Privy] wallet Stellar criada — subjectDid=${params.subjectDid.slice(0, 24)}..., ` +
        `address=${stellarWallet.address.slice(0, 8)}...`,
    );

    // Privy só devolve o keypair; a conta só existe on-chain depois de um
    // createAccount financiado. Ativa agora pra que a primeira auth já
    // encontre a conta pronta (sem o self-healing custar 5-10s de poll).
    await this.stellarService.ensureAccountExists(stellarWallet.address);

    return {
      privyUserId: user.id,
      privyWalletId: stellarWallet.id ?? null,
      stellarAddress: stellarWallet.address,
    };
  }

  /**
   * Cria a wallet financeira do issuer. Ela usa uma identidade Privy própria,
   * sem subjectDid, CPF ou qualquer metadado do portador da credencial.
   */
  public async provisionForOrganization(issuerId: string) {
    const issuer = await this.issuerRepository.findByExternalId(issuerId);
    if (!issuer) throw new Error(`Issuer ${issuerId} não encontrado`);

    const existing = await this.prisma.organizationWallet.findUnique({ where: { issuerId } });
    if (existing?.status === "ACTIVE" && existing.stellarAddress) {
      if (!existing.accountActivated) {
        await this.stellarService.ensureAccountExists(existing.stellarAddress);
      }
      return this.refreshOrganizationWalletReadiness(issuerId);
    }
    if (existing?.status === "SUSPENDED") return this.toOrganizationWalletResult(existing);

    const now = new Date();
    await this.prisma.organizationWallet.upsert({
      where: { issuerId },
      create: {
        id: Id.create("org_wallet").value,
        issuerId,
        network: this.stellarNetworkName(),
        status: "PENDING",
        assetCode: this.envService.STELLAR_PAYOUT_ASSET_CODE,
        assetIssuer: this.envService.STELLAR_PAYOUT_ASSET_ISSUER ?? null,
        createdAt: now,
        updatedAt: now,
      },
      update: { status: "PENDING", lastError: null, updatedAt: now },
    });

    try {
      if (!this.client) throw new Error("PRIVY_APP_ID/PRIVY_APP_SECRET não configurados");
      const client = this.client as unknown as PrivyClientLike;
      const user = await client.importUser({
        customMetadata: { issuerId, walletPurpose: "organization_payout" },
        linkedAccounts: [{ type: "custom_auth", customUserId: `vesta:issuer:${issuerId}` }],
        wallets: [{ chainType: "stellar" }],
      });
      const stellarWallet = this.findStellarWallet(user);
      if (!stellarWallet) throw new Error("Privy não retornou uma wallet Stellar organizacional");
      await this.stellarService.ensureAccountExists(stellarWallet.address);

      const nativeAsset = this.envService.STELLAR_PAYOUT_ASSET_CODE.toUpperCase() === "XLM";
      const readiness = await this.stellarService.getAccountReadiness(
        stellarWallet.address,
        this.envService.STELLAR_PAYOUT_ASSET_CODE,
        this.envService.STELLAR_PAYOUT_ASSET_ISSUER,
      );
      const saved = await this.prisma.organizationWallet.update({
        where: { issuerId },
        data: {
          privyUserId: user.id,
          privyWalletId: stellarWallet.id ?? null,
          stellarAddress: stellarWallet.address,
          network: this.stellarNetworkName(),
          status: "ACTIVE",
          accountActivated: readiness.accountActivated,
          trustlineReady: nativeAsset || readiness.trustlineReady,
          trustlineVerifiedAt: nativeAsset || readiness.trustlineReady ? new Date() : null,
          assetCode: this.envService.STELLAR_PAYOUT_ASSET_CODE,
          assetIssuer: this.envService.STELLAR_PAYOUT_ASSET_ISSUER ?? null,
          lastError: null,
          updatedAt: new Date(),
        },
      });
      return this.toOrganizationWalletResult(saved);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message.slice(0, 500) : "Falha desconhecida ao provisionar wallet";
      const failed = await this.prisma.organizationWallet.update({
        where: { issuerId },
        data: { status: "ERROR", lastError: message, updatedAt: new Date() },
      });
      this.logger.error(`[Privy] wallet organizacional ${issuerId}: ${message}`);
      return this.toOrganizationWalletResult(failed);
    }
  }

  public async getOrganizationWallet(issuerId: string) {
    const wallet = await this.prisma.organizationWallet.findUnique({ where: { issuerId } });
    if (!wallet) return null;
    if (!wallet.stellarAddress || wallet.status === "SUSPENDED") {
      return this.toOrganizationWalletResult(wallet);
    }
    return this.refreshOrganizationWalletReadiness(issuerId);
  }

  public getPrivyAppId(): string {
    if (!this.envService.PRIVY_APP_ID) throw new BadRequestException("Integração Privy não configurada");
    return this.envService.PRIVY_APP_ID;
  }

  public issueOrganizationAuthToken(issuerId: string) {
    return this.issueCustomAuthToken(`vesta:issuer:${issuerId}`);
  }

  public async confirmOrganizationWalletControl(params: {
    issuerId: string;
    userId: string;
    walletAddress: string;
    challenge: string;
    signature: string;
  }) {
    const wallet = await this.requireOrganizationWallet(params.issuerId);
    if (wallet.stellarAddress !== params.walletAddress) {
      throw new BadRequestException("A carteira mudou durante a confirmação; tente novamente");
    }
    const signatureBytes = Buffer.from(params.signature.replace(/^0x/, ""), "hex");
    const verified = Keypair.fromPublicKey(params.walletAddress).verify(
      Buffer.from(params.challenge, "hex"),
      signatureBytes,
    );
    if (!verified) throw new BadRequestException("Assinatura de controle da carteira inválida");

    await this.prisma.organizationWallet.update({
      where: { issuerId: params.issuerId },
      data: {
        controlVerifiedAt: new Date(),
        controlVerifiedByUserId: params.userId,
        lastError: null,
        updatedAt: new Date(),
      },
    });
    return this.refreshOrganizationWalletReadiness(params.issuerId);
  }

  public async refreshOrganizationWalletReadiness(issuerId: string) {
    const wallet = await this.requireOrganizationWallet(issuerId);
    if (!wallet.stellarAddress) return this.toOrganizationWalletResult(wallet);
    const readiness = await this.stellarService.getAccountReadiness(
      wallet.stellarAddress,
      wallet.assetCode,
      wallet.assetIssuer,
    );
    const saved = await this.prisma.organizationWallet.update({
      where: { issuerId },
      data: {
        accountActivated: readiness.accountActivated,
        trustlineReady: readiness.trustlineReady,
        trustlineVerifiedAt: readiness.trustlineReady ? new Date() : null,
        updatedAt: new Date(),
      },
    });
    return this.toOrganizationWalletResult(saved);
  }

  public async prepareOrganizationTrustline(issuerId: string) {
    const wallet = await this.requireOrganizationWallet(issuerId);
    if (!wallet.controlVerifiedAt) {
      throw new BadRequestException("Confirme o controle da carteira antes de criar a trustline");
    }
    if (!wallet.stellarAddress || !wallet.accountActivated) {
      throw new BadRequestException("A conta Stellar ainda não está ativa");
    }
    if (wallet.assetCode.toUpperCase() === "XLM") {
      throw new BadRequestException("XLM não requer trustline");
    }
    if (!wallet.assetIssuer) {
      throw new BadRequestException("Emissor do ativo de liquidação ainda não configurado");
    }
    const readiness = await this.refreshOrganizationWalletReadiness(issuerId);
    if (readiness.trustlineReady) return { alreadyReady: true, wallet: readiness };
    return {
      alreadyReady: false,
      wallet: readiness,
      transaction: await this.stellarService.buildTrustlineTransaction({
        address: wallet.stellarAddress,
        assetCode: wallet.assetCode,
        assetIssuer: wallet.assetIssuer,
      }),
    };
  }

  public async submitOrganizationTrustline(params: { issuerId: string; unsignedXdr: string; signature: string }) {
    const wallet = await this.requireOrganizationWallet(params.issuerId);
    if (!wallet.controlVerifiedAt || !wallet.stellarAddress || !wallet.assetIssuer) {
      throw new BadRequestException("Carteira não está apta a criar a trustline");
    }
    try {
      const submitted = await this.stellarService.submitTrustlineTransaction({
        address: wallet.stellarAddress,
        assetCode: wallet.assetCode,
        assetIssuer: wallet.assetIssuer,
        unsignedXdr: params.unsignedXdr,
        signature: params.signature,
      });
      return { ...submitted, wallet: await this.refreshOrganizationWalletReadiness(params.issuerId) };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Falha ao criar trustline";
      throw new BadRequestException(message);
    }
  }

  public async issueCustomAuthToken(subjectDid: string): Promise<{ token: string; expiresAt: number }> {
    const { privateKey, keyId } = this.requireCustomAuthSigningKey();

    const expiresInSeconds = 60;
    const token = await this.jwtService.signAsync(
      {},
      {
        algorithm: "ES256",
        privateKey,
        keyid: keyId,
        issuer: this.envService.PRIVY_CUSTOM_AUTH_ISSUER,
        audience: this.envService.PRIVY_APP_ID,
        subject: subjectDid,
        expiresIn: expiresInSeconds,
      },
    );
    return { token, expiresAt: Date.now() + expiresInSeconds * 1000 };
  }

  /**
   * Public verification material consumed by Privy for ES256 custom-auth JWTs.
   * The public key is derived from the configured private key so signing and
   * verification cannot silently drift to different key pairs.
   */
  public getCustomAuthJwks(): CustomAuthJwks {
    if (this.customAuthJwks) return this.customAuthJwks;

    const { privateKey, keyId } = this.requireCustomAuthSigningKey();
    const publicJwk = createPublicKey(privateKey).export({ format: "jwk" });
    if (
      publicJwk.kty !== "EC" ||
      publicJwk.crv !== "P-256" ||
      typeof publicJwk.x !== "string" ||
      typeof publicJwk.y !== "string"
    ) {
      throw new Error("PRIVY_CUSTOM_AUTH_PRIVATE_KEY deve ser uma chave EC P-256 para ES256");
    }

    this.customAuthJwks = {
      keys: [
        {
          alg: "ES256",
          crv: "P-256",
          kid: keyId,
          kty: "EC",
          use: "sig",
          x: publicJwk.x,
          y: publicJwk.y,
        },
      ],
    };
    return this.customAuthJwks;
  }

  private requireCustomAuthSigningKey(): { privateKey: string; keyId: string } {
    const privateKey = this.envService.PRIVY_CUSTOM_AUTH_PRIVATE_KEY?.replace(/\\n/g, "\n");
    const keyId = this.envService.PRIVY_CUSTOM_AUTH_KEY_ID;
    if (!privateKey || !keyId) {
      throw new Error(
        "Privy custom auth não configurado: defina PRIVY_CUSTOM_AUTH_PRIVATE_KEY e PRIVY_CUSTOM_AUTH_KEY_ID",
      );
    }
    return { privateKey, keyId };
  }

  /**
   * Verifica um access token Privy recebido do SDK e extrai claims.
   * Usado pelo handler /public/proof/submit-signed para confirmar que a
   * assinatura veio do usuario esperado.
   */
  public async verifyAccessToken(token: string): Promise<PrivyIdentityClaims> {
    if (!this.client) {
      throw new Error("WalletService.verifyAccessToken chamado sem Privy configurado");
    }

    const client = this.client as unknown as PrivyClientLike;
    const claims = await client.verifyAuthToken(token);
    const user = await client.getUser(claims.userId);
    if (!user) {
      throw new Error(`Usuario Privy ${claims.userId} nao encontrado`);
    }

    const stellarWallet = this.findStellarWallet(user);
    if (!stellarWallet) {
      throw new Error(`Usuario Privy ${claims.userId} sem wallet Stellar associada`);
    }

    return {
      userId: claims.userId,
      walletAddress: stellarWallet.address,
    };
  }

  private findStellarWallet(user: PrivyUser): PrivyLinkedWallet | null {
    if (!user.linkedAccounts) return null;

    for (const account of user.linkedAccounts) {
      if (account.type !== "wallet") continue;
      const chainType = typeof account.chainType === "string" ? account.chainType : undefined;
      const address = typeof account.address === "string" ? account.address : undefined;
      if (!address) continue;

      // Aceita explicito (chainType === 'stellar') ou heuristica pelo formato
      // do address (Stellar publico comeca com 'G'), para tolerar variacoes de
      // resposta entre versoes do SDK.
      if (chainType === "stellar" || (chainType === undefined && address.startsWith("G"))) {
        return {
          id: typeof account.id === "string" ? account.id : undefined,
          type: "wallet",
          address,
          chainType,
          walletClientType: typeof account.walletClientType === "string" ? account.walletClientType : undefined,
        };
      }
    }
    return null;
  }

  private stellarNetworkName(): "testnet" | "mainnet" | "custom" {
    const network = this.envService.STELLAR_NETWORK;
    if (network.includes("Test SDF Network")) return "testnet";
    if (network.includes("Public Global Stellar Network")) return "mainnet";
    return "custom";
  }

  private async requireOrganizationWallet(issuerId: string) {
    const wallet = await this.prisma.organizationWallet.findUnique({ where: { issuerId } });
    if (!wallet) throw new BadRequestException("Carteira organizacional ainda não provisionada");
    return wallet;
  }

  private toOrganizationWalletResult(wallet: {
    issuerId: string;
    stellarAddress: string | null;
    network: string;
    status: string;
    accountActivated: boolean;
    trustlineReady: boolean;
    controlVerifiedAt: Date | null;
    trustlineVerifiedAt: Date | null;
    assetCode: string;
    assetIssuer: string | null;
    lastError: string | null;
    updatedAt: Date;
  }) {
    const controlVerified = Boolean(wallet.controlVerifiedAt);
    const payoutReady =
      wallet.status === "ACTIVE" && wallet.accountActivated && wallet.trustlineReady && controlVerified;
    const activationState =
      wallet.status === "ERROR"
        ? "ERROR"
        : wallet.status === "SUSPENDED"
          ? "SUSPENDED"
          : !wallet.stellarAddress || !wallet.accountActivated
            ? "PROVISIONING"
            : !controlVerified
              ? "PENDING_CONTROL"
              : !wallet.trustlineReady
                ? "PENDING_TRUSTLINE"
                : "READY";
    return {
      issuerId: wallet.issuerId,
      address: wallet.stellarAddress,
      network: wallet.network,
      status: wallet.status,
      accountActivated: wallet.accountActivated,
      trustlineReady: wallet.trustlineReady,
      controlVerified,
      controlVerifiedAt: wallet.controlVerifiedAt?.toISOString() ?? null,
      trustlineVerifiedAt: wallet.trustlineVerifiedAt?.toISOString() ?? null,
      activationState,
      payoutReady,
      asset: { code: wallet.assetCode, issuer: wallet.assetIssuer },
      lastError:
        wallet.status === "ERROR" ? "Provisionamento não concluído. Contate o suporte para uma nova tentativa." : null,
      updatedAt: wallet.updatedAt.toISOString(),
    };
  }
}
