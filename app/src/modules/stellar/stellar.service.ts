import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from "@nestjs/common";
import { EnvService } from "@src/infra/env/env.service";
import type { EncodedProof, EncodedVerificationKey } from "@src/shared/types/vesta-vc.types";
import {
  BASE_FEE,
  Asset,
  Contract,
  FeeBumpTransaction,
  Keypair,
  Horizon,
  Operation,
  rpc as SorobanRpc,
  Transaction,
  TransactionBuilder,
  nativeToScVal,
  xdr,
} from "@stellar/stellar-sdk";

export interface ZkSubmitParams {
  encodedProof: EncodedProof;
  encodedVk: EncodedVerificationKey;
  encodedPublicSignals: Buffer[];
  vcHash: string;
  verifierId: string;
}

export interface BuildUnsignedZkProofTxParams extends ZkSubmitParams {
  source: string;
}

export interface BuildUnsignedZkProofTxResult {
  unsignedXdr: string;
  innerTxHash: string;
  sourceAccountSignedByBackend: boolean;
}

export interface StellarSubmitResult {
  txHash: string;
  ledger: number;
  onChainResult: boolean;
  mock: boolean;
}

export interface StellarAccountReadiness {
  accountActivated: boolean;
  trustlineReady: boolean;
  trustlineLedger: number | null;
}

export interface UnsignedTrustlineTransaction {
  unsignedXdr: string;
  transactionHash: `0x${string}`;
  expiresAt: string;
}

@Injectable()
export class StellarService implements OnModuleInit {
  private readonly logger = new Logger(StellarService.name);
  private readonly rpcUrl: string;
  private readonly networkPassphrase: string;
  private readonly contractId: string;
  private readonly deployerSecret: string;
  private mockMode: boolean;
  private server!: SorobanRpc.Server;
  private horizon!: Horizon.Server;

  public constructor(private readonly envService: EnvService) {
    this.rpcUrl = envService.STELLAR_RPC_URL;
    this.networkPassphrase = envService.STELLAR_NETWORK;
    this.contractId = envService.VESTA_CONTRACT_ID;
    this.deployerSecret = envService.VESTA_DEPLOYER_SECRET;
    this.mockMode = this.contractId === "PLACEHOLDER" || !this.deployerSecret;
  }

  public onModuleInit(): void {
    this.server = new SorobanRpc.Server(this.rpcUrl);
    const horizonUrl =
      this.envService.STELLAR_HORIZON_URL ??
      (this.networkPassphrase.includes("Public Global Stellar Network")
        ? "https://horizon.stellar.org"
        : "https://horizon-testnet.stellar.org");
    this.horizon = new Horizon.Server(horizonUrl);

    if (this.mockMode) {
      this.logger.warn(
        "Stellar em MOCK MODE — configure VESTA_CONTRACT_ID e VESTA_DEPLOYER_SECRET " +
          "para ativar verificação on-chain real.",
      );
    } else {
      this.logger.log(`Stellar Soroban conectado — Contrato: ${this.contractId}`);
    }
  }

  public async getAccountReadiness(
    address: string,
    assetCode: string,
    assetIssuer?: string | null,
  ): Promise<StellarAccountReadiness> {
    try {
      const account = await this.horizon.loadAccount(address);
      if (assetCode.toUpperCase() === "XLM") {
        return { accountActivated: true, trustlineReady: true, trustlineLedger: null };
      }
      if (!assetIssuer) {
        return { accountActivated: true, trustlineReady: false, trustlineLedger: null };
      }
      const trustline = account.balances.find(
        (balance) =>
          "asset_code" in balance && balance.asset_code === assetCode && balance.asset_issuer === assetIssuer,
      );
      return {
        accountActivated: true,
        trustlineReady: Boolean(
          trustline &&
          "is_authorized" in trustline &&
          "limit" in trustline &&
          trustline.is_authorized &&
          Number(trustline.limit) > 0,
        ),
        trustlineLedger: trustline && "last_modified_ledger" in trustline ? trustline.last_modified_ledger : null,
      };
    } catch (cause) {
      const status = (cause as { response?: { status?: number } }).response?.status;
      if (status === 404) {
        return { accountActivated: false, trustlineReady: false, trustlineLedger: null };
      }
      this.logger.error(`Falha ao validar conta ${address} no Horizon: ${(cause as Error).message}`);
      throw new ServiceUnavailableException("Não foi possível validar a conta Stellar agora");
    }
  }

  public async buildTrustlineTransaction(params: {
    address: string;
    assetCode: string;
    assetIssuer: string;
  }): Promise<UnsignedTrustlineTransaction> {
    if (!this.deployerSecret) {
      throw new ServiceUnavailableException("Patrocinador Stellar da trustline não configurado");
    }
    const account = await this.horizon.loadAccount(params.address);
    const sponsor = Keypair.fromSecret(this.deployerSecret);
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);
    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        Operation.beginSponsoringFutureReserves({
          source: sponsor.publicKey(),
          sponsoredId: params.address,
        }),
      )
      .addOperation(
        Operation.changeTrust({
          source: params.address,
          asset: new Asset(params.assetCode, params.assetIssuer),
        }),
      )
      .addOperation(Operation.endSponsoringFutureReserves({ source: params.address }))
      .setTimeout(120)
      .build();
    transaction.sign(sponsor);
    return {
      unsignedXdr: transaction.toXDR(),
      transactionHash: `0x${transaction.hash().toString("hex")}`,
      expiresAt: expiresAt.toISOString(),
    };
  }

  public async submitTrustlineTransaction(params: {
    address: string;
    assetCode: string;
    assetIssuer: string;
    unsignedXdr: string;
    signature: string;
  }): Promise<{ txHash: string; ledger: number }> {
    const parsed = TransactionBuilder.fromXDR(params.unsignedXdr, this.networkPassphrase);
    if (!(parsed instanceof Transaction)) throw new Error("Fee bump não permitido na ativação da trustline");
    if (!this.deployerSecret || parsed.source !== params.address || parsed.operations.length !== 3) {
      throw new Error("Transação de trustline inválida");
    }
    const sponsor = Keypair.fromSecret(this.deployerSecret);
    const beginSponsorship = parsed.operations[0];
    const operation = parsed.operations[1];
    const endSponsorship = parsed.operations[2];
    if (
      beginSponsorship.type !== "beginSponsoringFutureReserves" ||
      beginSponsorship.source !== sponsor.publicKey() ||
      beginSponsorship.sponsoredId !== params.address ||
      operation.type !== "changeTrust" ||
      operation.source !== params.address ||
      !(operation.line instanceof Asset) ||
      operation.line.getCode() !== params.assetCode ||
      operation.line.getIssuer() !== params.assetIssuer ||
      endSponsorship.type !== "endSponsoringFutureReserves" ||
      endSponsorship.source !== params.address
    ) {
      throw new Error("Ativo da trustline não corresponde à configuração de repasse");
    }
    const sponsorSigned = parsed.signatures.some((decorated) => sponsor.verify(parsed.hash(), decorated.signature()));
    if (!sponsorSigned) throw new Error("Patrocínio da trustline não está assinado pela Vesta");
    const signatureHex = params.signature.replace(/^0x/, "");
    const signatureBytes = Buffer.from(signatureHex, "hex");
    if (!Keypair.fromPublicKey(params.address).verify(parsed.hash(), signatureBytes)) {
      throw new Error("Assinatura Stellar inválida");
    }
    parsed.addSignature(params.address, signatureBytes.toString("base64"));
    const submitted = await this.horizon.submitTransaction(parsed);
    return { txHash: submitted.hash, ledger: submitted.ledger };
  }

  public getNetworkPassphrase(): string {
    return this.networkPassphrase;
  }

  public isMockMode(): boolean {
    return this.mockMode;
  }

  public getContractId(): string {
    return this.contractId;
  }

  public getDeployerAddress(): string {
    if (!this.deployerSecret) return "";
    return Keypair.fromSecret(this.deployerSecret).publicKey();
  }

  /**
   * Ativa uma conta Stellar on-chain financiando-a a partir do deployer.
   *
   * Privy só gera o keypair; a conta só passa a existir no ledger depois de
   * um createAccount. Idempotente: se `getAccount` responde ok, é no-op.
   * Chamado tanto na criação da wallet (WalletService) quanto no fallback de
   * usuários retroativos dentro de buildUnsignedZkProofTx.
   */
  public async ensureAccountExists(address: string): Promise<void> {
    if (this.mockMode) return;

    try {
      await this.server.getAccount(address);
      return;
    } catch (err) {
      const msg = (err as Error).message;
      if (!/account not found/i.test(msg)) {
        this.logger.error(`ensureAccountExists: falha inesperada em getAccount(${address}): ${msg}`);
        throw new ServiceUnavailableException("Serviço blockchain temporariamente indisponível");
      }
    }

    const deployer = Keypair.fromSecret(this.deployerSecret);
    this.logger.log(`Ativando conta Stellar ${address} — financiando 1.5 XLM a partir do deployer`);

    let deployerAccount;
    try {
      deployerAccount = await this.server.getAccount(deployer.publicKey());
    } catch (err) {
      this.logger.error(`ensureAccountExists: getAccount(deployer) falhou: ${(err as Error).message}`);
      throw new ServiceUnavailableException("Serviço blockchain temporariamente indisponível");
    }

    const tx = new TransactionBuilder(deployerAccount, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(Operation.createAccount({ destination: address, startingBalance: "1.5" }))
      .setTimeout(30)
      .build();
    tx.sign(deployer);

    let sendResult;
    try {
      sendResult = await this.server.sendTransaction(tx);
    } catch (err) {
      this.logger.error(`ensureAccountExists: sendTransaction falhou: ${(err as Error).message}`);
      throw new ServiceUnavailableException("Serviço blockchain temporariamente indisponível");
    }

    if (sendResult.status === "ERROR") {
      // op_already_exists = race: outra chamada concorrente já ativou — sucesso.
      const errStr = JSON.stringify(sendResult.errorResult);
      if (/already_exists/i.test(errStr)) {
        this.logger.warn(`ensureAccountExists: conta ${address} ativada por outra chamada concorrente`);
        return;
      }
      this.logger.error(`ensureAccountExists: createAccount rejeitada: ${errStr}`);
      throw new ServiceUnavailableException("Falha ao ativar conta Stellar");
    }

    // pollTransactionResult interpreta returnValue como bool (protocolo Soroban);
    // createAccount não tem returnValue, então checamos status direto aqui.
    const txHash = sendResult.hash;
    const maxAttempts = 15;
    const delayMs = 2000;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await new Promise<void>((r) => setTimeout(r, delayMs));
      const result = await this.server.getTransaction(txHash);
      if (result.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
        this.logger.log(`Conta Stellar ${address} ativada (tentativa ${attempt}) — tx: ${txHash}`);
        return;
      }
      if (result.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
        this.logger.error(`Ativação de conta ${address} rejeitada on-chain — tx: ${txHash}`);
        throw new ServiceUnavailableException("Falha ao ativar conta Stellar");
      }
    }
    throw new ServiceUnavailableException("Ativação de conta Stellar não confirmada no ledger");
  }

  /**
   * Monta uma tx Soroban invoke_host_function preparada (simulada + ajustada),
   * com source dinâmico — pode ser o endereço da wallet do usuário (modo
   * Privy) OU o deployer da Vesta (modo legado interno).
   *
   * Retorna o XDR sem assinar. Quando o source é o deployer, o backend já
   * assina antes de retornar (campo sourceAccountSignedByBackend=true) para
   * o SDK apenas repassar; quando é o usuário, o SDK precisa assinar antes
   * de chamar submitWithFeeBump.
   */
  public async buildUnsignedZkProofTx(params: BuildUnsignedZkProofTxParams): Promise<BuildUnsignedZkProofTxResult> {
    if (this.mockMode) {
      // Em mock mode, retorna XDR placeholder — submit-signed também mockado
      return {
        unsignedXdr: `MOCK_XDR_${Date.now()}`,
        innerTxHash: `MOCK_TX_${Date.now()}`,
        sourceAccountSignedByBackend: true,
      };
    }

    const contract = new Contract(this.contractId);

    let account;
    try {
      account = await this.server.getAccount(params.source);
    } catch (err) {
      const msg = (err as Error).message;
      const isNotFound = /account not found/i.test(msg);
      const isUserWallet = params.source !== this.getDeployerAddress();

      if (isNotFound && isUserWallet) {
        // Wallet do usuário existe no Privy/DB mas nunca foi financiada on-chain
        // (usuários criados antes do fix de ativação automática). Ativa e refaz.
        this.logger.warn(`Wallet ${params.source} não ativa on-chain — tentando ativar via deployer`);
        await this.ensureAccountExists(params.source);
        account = await this.server.getAccount(params.source);
      } else {
        this.logger.error(`Não foi possível carregar conta Stellar (${params.source}): ${msg}`);
        throw new ServiceUnavailableException("Serviço blockchain temporariamente indisponível");
      }
    }

    const args = this.buildVerifyProofArgs(params);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(contract.call("verify_proof", ...args))
      .setTimeout(60)
      .build();

    let preparedTx;
    try {
      preparedTx = await this.server.prepareTransaction(tx);
    } catch (err) {
      this.logger.error(`Falha ao preparar transação Soroban: ${(err as Error).message}`);
      throw new ServiceUnavailableException("Serviço blockchain temporariamente indisponível");
    }

    const isDeployerSource = params.source === this.getDeployerAddress();
    let sourceAccountSignedByBackend = false;

    if (isDeployerSource) {
      // Modo legado interno (Issuer sem privyEnabled). O backend assina como
      // source porque o SDK não tem acesso à chave do deployer.
      const keypair = Keypair.fromSecret(this.deployerSecret);
      preparedTx.sign(keypair);
      sourceAccountSignedByBackend = true;
    }

    return {
      unsignedXdr: preparedTx.toXDR(),
      innerTxHash: preparedTx.hash().toString("hex"),
      sourceAccountSignedByBackend,
    };
  }

  /**
   * Recebe uma tx XDR já assinada (pelo usuário, ou pelo backend em modo
   * legado), envolve em FeeBumpTransaction patrocinada pelo deployer Vesta,
   * submete e aguarda confirmação.
   */
  public async submitWithFeeBump(signedTxXdr: string): Promise<StellarSubmitResult> {
    if (this.mockMode) {
      return this.buildMockResult();
    }

    const deployerKeypair = Keypair.fromSecret(this.deployerSecret);

    let innerTx: Transaction;
    try {
      const parsed = TransactionBuilder.fromXDR(signedTxXdr, this.networkPassphrase);
      if (parsed instanceof FeeBumpTransaction) {
        throw new ServiceUnavailableException("XDR recebido já é uma fee-bump tx — abortando");
      }
      innerTx = parsed as Transaction;
    } catch (err) {
      this.logger.error(`XDR recebido inválido: ${(err as Error).message}`);
      throw new ServiceUnavailableException("Transação assinada inválida");
    }

    // Fee suficiente pra cobrir gas Soroban; Stellar exige >= 2x BASE_FEE
    const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
      deployerKeypair,
      (parseInt(BASE_FEE, 10) * 10).toString(),
      innerTx,
      this.networkPassphrase,
    );
    feeBumpTx.sign(deployerKeypair);

    let sendResult;
    try {
      sendResult = await this.server.sendTransaction(feeBumpTx);
    } catch (err) {
      this.logger.error(`Falha ao enviar fee-bump tx: ${(err as Error).message}`);
      throw new ServiceUnavailableException("Serviço blockchain temporariamente indisponível");
    }

    if (sendResult.status === "ERROR") {
      this.logger.error(`Fee-bump tx rejeitada: ${JSON.stringify(sendResult.errorResult)}`);
      throw new ServiceUnavailableException("Transação blockchain rejeitada");
    }

    const txHash = sendResult.hash;
    this.logger.log(`Fee-bump tx enviada — hash: ${txHash}`);

    const { ledger, onChainResult } = await this.pollTransactionResult(txHash);
    return { txHash, ledger, onChainResult, mock: false };
  }

  private buildVerifyProofArgs(params: ZkSubmitParams): xdr.ScVal[] {
    const toBuffer = (v: Buffer | { type: string; data: number[] }): Buffer =>
      Buffer.isBuffer(v) ? v : Buffer.from((v as { type: string; data: number[] }).data);
    const bufToScVal = (buf: Buffer | { type: string; data: number[] }) =>
      nativeToScVal(toBuffer(buf), { type: "bytes" });

    const vkIcScVals = params.encodedVk.ic.map(bufToScVal);
    const pubSignalScVals = params.encodedPublicSignals.map(bufToScVal);

    return [
      bufToScVal(params.encodedProof.negatedA),
      bufToScVal(params.encodedProof.proofB),
      bufToScVal(params.encodedProof.proofC),
      bufToScVal(params.encodedVk.alpha),
      bufToScVal(params.encodedVk.beta),
      bufToScVal(params.encodedVk.gamma),
      bufToScVal(params.encodedVk.delta),
      xdr.ScVal.scvVec(vkIcScVals),
      xdr.ScVal.scvVec(pubSignalScVals),
      nativeToScVal(params.vcHash, { type: "string" }),
    ];
  }

  public async submitZkProof(params: ZkSubmitParams): Promise<StellarSubmitResult> {
    this.logger.log(`Submetendo prova ao Soroban — VC: ${params.vcHash.slice(0, 16)}...`);

    if (this.mockMode) {
      return this.buildMockResult();
    }

    return this.submitRealTransaction(params);
  }

  private async submitRealTransaction(params: ZkSubmitParams): Promise<StellarSubmitResult> {
    const keypair = Keypair.fromSecret(this.deployerSecret);
    const contract = new Contract(this.contractId);
    const { encodedProof, encodedVk, encodedPublicSignals } = params;

    let account;
    try {
      account = await this.server.getAccount(keypair.publicKey());
    } catch (err) {
      this.logger.error(`Não foi possível carregar conta Stellar: ${(err as Error).message}`);
      throw new ServiceUnavailableException("Serviço blockchain temporariamente indisponível");
    }

    const toBuffer = (v: Buffer | { type: string; data: number[] }): Buffer =>
      Buffer.isBuffer(v) ? v : Buffer.from((v as { type: string; data: number[] }).data);

    const bufToScVal = (buf: Buffer | { type: string; data: number[] }) =>
      nativeToScVal(toBuffer(buf), { type: "bytes" });

    const vkIcScVals = encodedVk.ic.map(bufToScVal);
    const pubSignalScVals = encodedPublicSignals.map(bufToScVal);

    const args = [
      bufToScVal(encodedProof.negatedA),
      bufToScVal(encodedProof.proofB),
      bufToScVal(encodedProof.proofC),
      bufToScVal(encodedVk.alpha),
      bufToScVal(encodedVk.beta),
      bufToScVal(encodedVk.gamma),
      bufToScVal(encodedVk.delta),
      xdr.ScVal.scvVec(vkIcScVals),
      xdr.ScVal.scvVec(pubSignalScVals),
      nativeToScVal(params.vcHash, { type: "string" }),
    ];

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(contract.call("verify_proof", ...args))
      .setTimeout(30)
      .build();

    let preparedTx;
    try {
      preparedTx = await this.server.prepareTransaction(tx);
    } catch (err) {
      this.logger.error(`Falha ao preparar transação Soroban: ${(err as Error).message}`);
      throw new ServiceUnavailableException("Serviço blockchain temporariamente indisponível");
    }

    preparedTx.sign(keypair);

    let sendResult;
    try {
      sendResult = await this.server.sendTransaction(preparedTx);
    } catch (err) {
      this.logger.error(`Falha ao enviar transação Soroban: ${(err as Error).message}`);
      throw new ServiceUnavailableException("Serviço blockchain temporariamente indisponível");
    }

    if (sendResult.status === "ERROR") {
      this.logger.error(`Transação Soroban rejeitada: ${JSON.stringify(sendResult.errorResult)}`);
      throw new ServiceUnavailableException("Transação blockchain rejeitada");
    }

    const txHash = sendResult.hash;
    this.logger.log(`TX enviada — hash: ${txHash}`);

    const { ledger, onChainResult } = await this.pollTransactionResult(txHash);
    return { txHash, ledger, onChainResult, mock: false };
  }

  private async pollTransactionResult(
    txHash: string,
    maxAttempts = 15,
    delayMs = 2000,
  ): Promise<{ ledger: number; onChainResult: boolean }> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await new Promise<void>((r) => setTimeout(r, delayMs));

      const result = await this.server.getTransaction(txHash);

      if (result.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
        this.logger.log(`TX confirmada (tentativa ${attempt}) — ledger: ${result.ledger}`);
        const onChainResult = this.parseReturnBool(result.returnValue);
        return { ledger: result.ledger, onChainResult };
      }

      if (result.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
        this.logger.error(`TX falhou — hash: ${txHash}`);
        return { ledger: 0, onChainResult: false };
      }

      this.logger.debug(`TX pendente (${attempt}/${maxAttempts})...`);
    }

    this.logger.warn(`TX não confirmada após ${maxAttempts} tentativas`);
    return { ledger: 0, onChainResult: false };
  }

  private parseReturnBool(returnValue: xdr.ScVal | undefined): boolean {
    if (!returnValue) return false;
    try {
      return returnValue.b();
    } catch {
      return false;
    }
  }

  private buildMockResult(): StellarSubmitResult {
    return {
      txHash: `MOCK_TX_${Date.now()}`,
      ledger: 0,
      onChainResult: true,
      mock: true,
    };
  }
}
