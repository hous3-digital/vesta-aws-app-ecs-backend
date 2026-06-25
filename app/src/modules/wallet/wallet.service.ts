import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { EnvService } from "@src/infra/env/env.service";
import { IIssuerRepository } from "@src/modules/issuer/domain/issuer.repository";
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

@Injectable()
export class WalletService implements OnModuleInit {
  private readonly logger = new Logger(WalletService.name);
  private client: PrivyClient | null = null;
  private enabled = false;

  public constructor(
    private readonly envService: EnvService,
    private readonly issuerRepository: IIssuerRepository,
  ) {}

  public onModuleInit(): void {
    const appId = this.envService.PRIVY_APP_ID;
    const appSecret = this.envService.PRIVY_APP_SECRET;

    if (!appId || !appSecret) {
      this.logger.warn(
        "WalletService desativado — PRIVY_APP_ID/PRIVY_APP_SECRET ausentes. " +
          "Fluxo Privy só funcionará após configuração.",
      );
      this.enabled = false;
      return;
    }

    this.client = new PrivyClient(appId, appSecret);
    this.enabled = true;
    this.logger.log("Privy client inicializado");
  }

  /**
   * Indica se a integração Privy está habilitada para o issuer informado.
   * Retorna false se o client Privy não está configurado OU se o issuer
   * não tem o feature flag ativo no banco.
   */
  public async isEnabledForIssuer(externalIssuerId: string): Promise<boolean> {
    if (!this.enabled) return false;
    const issuer = await this.issuerRepository.findByExternalId(externalIssuerId);
    return !!issuer?.privyEnabled;
  }

  /**
   * Pré-cria uma wallet Stellar Privy vinculada ao subjectDid da credencial.
   * Usa o subjectDid como identificador externo no Privy para idempotência —
   * chamadas repetidas com o mesmo subjectDid retornam a mesma wallet.
   */
  public async precreateForCredential(params: {
    subjectDid: string;
    cpfDedupKey: string | null;
  }): Promise<PrecreateWalletResult> {
    if (!this.client) {
      throw new Error("WalletService.precreateForCredential chamado sem Privy configurado");
    }

    // Cria/recupera o usuário Privy via custom auth (subjectDid como chave externa).
    // Documentação: https://docs.privy.io/guide/server/users/import
    // NOTA: a tipagem oficial do @privy-io/server-auth está em flux para Stellar;
    // usamos cast defensivo até validar a versão suportada com uma conta real.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = this.client as unknown as any;
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
      // Cria automaticamente uma wallet Stellar embedada. O nome do parâmetro
      // depende da versão Privy; validar com a conta real antes de produção.
      createEmbeddedWallets: { stellar: true },
    });

    const stellarAccount = user.linkedAccounts?.find(
      (acc: { type: string; address?: string }) =>
        acc.type === "wallet" && acc.address?.startsWith("G"),
    ) as { address: string } | undefined;

    if (!stellarAccount?.address) {
      throw new Error(
        `Privy não retornou endereço Stellar para subjectDid ${params.subjectDid}`,
      );
    }

    this.logger.log(
      `Wallet Privy criada — subjectDid=${params.subjectDid.slice(0, 24)}..., address=${stellarAccount.address.slice(0, 8)}...`,
    );

    return {
      privyUserId: user.id,
      stellarAddress: stellarAccount.address,
    };
  }

  /**
   * Verifica um identity token Privy recebido do SDK e extrai claims.
   * Usado pelo handler /public/proof/submit-signed para confirmar que a
   * assinatura veio do usuário esperado.
   */
  public async verifyIdentityToken(token: string): Promise<PrivyIdentityClaims> {
    if (!this.client) {
      throw new Error("WalletService.verifyIdentityToken chamado sem Privy configurado");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = this.client as unknown as any;
    const claims = await client.verifyAuthToken(token);
    const user = await client.getUser(claims.userId);
    if (!user) {
      throw new Error(`Usuário Privy ${claims.userId} não encontrado`);
    }

    const stellarAccount = user.linkedAccounts?.find(
      (acc: { type: string; address?: string }) =>
        acc.type === "wallet" && acc.address?.startsWith("G"),
    ) as { address: string } | undefined;

    if (!stellarAccount?.address) {
      throw new Error(`Usuário Privy ${claims.userId} sem wallet Stellar associada`);
    }

    return {
      userId: claims.userId,
      walletAddress: stellarAccount.address,
    };
  }

  /**
   * Resolve a wallet Stellar associada a um subjectDid. Retorna null se
   * não houver wallet (usuário Privy não foi pré-criado).
   * Usado pelo handler /public/proof/prepare para montar a tx com source
   * = userWalletAddress quando aplicável.
   */
  public async getWalletForSubject(
    subjectDid: string,
  ): Promise<{ address: string; privyUserId: string } | null> {
    if (!this.client) return null;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = this.client as unknown as any;
      const user = await client.getUserByCustomAuthId(subjectDid);
      if (!user) return null;

      const stellarAccount = user.linkedAccounts?.find(
        (acc: { type: string; address?: string }) =>
          acc.type === "wallet" && acc.address?.startsWith("G"),
      ) as { address: string } | undefined;

      if (!stellarAccount?.address) return null;

      return {
        address: stellarAccount.address,
        privyUserId: user.id,
      };
    } catch (err) {
      this.logger.debug(`getWalletForSubject não encontrou wallet: ${(err as Error).message}`);
      return null;
    }
  }
}
