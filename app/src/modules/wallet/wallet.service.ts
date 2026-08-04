import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { EnvService } from "@src/infra/env/env.service";
import { IIssuerRepository } from "@src/modules/issuer/domain/issuer.repository";
import { StellarService } from "@src/modules/stellar/stellar.service";
// Privy server SDK — instalado via @privy-io/server-auth
import { PrivyClient } from "@privy-io/server-auth";

export interface PrecreateWalletResult {
  privyUserId: string;
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

  public constructor(
    private readonly envService: EnvService,
    private readonly issuerRepository: IIssuerRepository,
    private readonly stellarService: StellarService,
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

    this.logger.log(
      `[Privy] importUser start — subjectDid=${params.subjectDid.slice(0, 24)}..., wallets=[stellar]`,
    );

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
      throw new Error(
        `Privy nao retornou endereco Stellar para subjectDid ${params.subjectDid}`,
      );
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
      stellarAddress: stellarWallet.address,
    };
  }

  /**
   * Verifica um identity token Privy recebido do SDK e extrai claims.
   * Usado pelo handler /public/proof/submit-signed para confirmar que a
   * assinatura veio do usuario esperado.
   */
  public async verifyIdentityToken(token: string): Promise<PrivyIdentityClaims> {
    if (!this.client) {
      throw new Error("WalletService.verifyIdentityToken chamado sem Privy configurado");
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
          type: "wallet",
          address,
          chainType,
          walletClientType:
            typeof account.walletClientType === "string" ? account.walletClientType : undefined,
        };
      }
    }
    return null;
  }
}
