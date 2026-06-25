import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from "@nestjs/common";
import { EnvService } from "@src/infra/env/env.service";
import type { EncodedProof, EncodedVerificationKey } from "@src/shared/types/vesta-vc.types";
import {
  BASE_FEE,
  Contract,
  FeeBumpTransaction,
  Keypair,
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

@Injectable()
export class StellarService implements OnModuleInit {
  private readonly logger = new Logger(StellarService.name);
  private readonly rpcUrl: string;
  private readonly networkPassphrase: string;
  private readonly contractId: string;
  private readonly deployerSecret: string;
  private mockMode: boolean;
  private server!: SorobanRpc.Server;

  public constructor(private readonly envService: EnvService) {
    this.rpcUrl = envService.STELLAR_RPC_URL;
    this.networkPassphrase = envService.STELLAR_NETWORK;
    this.contractId = envService.VESTA_CONTRACT_ID;
    this.deployerSecret = envService.VESTA_DEPLOYER_SECRET;
    this.mockMode = this.contractId === "PLACEHOLDER" || !this.deployerSecret;
  }

  public onModuleInit(): void {
    this.server = new SorobanRpc.Server(this.rpcUrl);

    if (this.mockMode) {
      this.logger.warn(
        "Stellar em MOCK MODE — configure VESTA_CONTRACT_ID e VESTA_DEPLOYER_SECRET " + "para ativar verificação on-chain real.",
      );
    } else {
      this.logger.log(`Stellar Soroban conectado — Contrato: ${this.contractId}`);
    }
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
   * Monta uma tx Soroban invoke_host_function preparada (simulada + ajustada),
   * com source dinâmico — pode ser o endereço da wallet do usuário (modo
   * Privy) OU o deployer da Vesta (modo legado interno).
   *
   * Retorna o XDR sem assinar. Quando o source é o deployer, o backend já
   * assina antes de retornar (campo sourceAccountSignedByBackend=true) para
   * o SDK apenas repassar; quando é o usuário, o SDK precisa assinar antes
   * de chamar submitWithFeeBump.
   */
  public async buildUnsignedZkProofTx(
    params: BuildUnsignedZkProofTxParams,
  ): Promise<BuildUnsignedZkProofTxResult> {
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
      this.logger.error(`Não foi possível carregar conta Stellar (${params.source}): ${(err as Error).message}`);
      throw new ServiceUnavailableException("Serviço blockchain temporariamente indisponível");
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

    const bufToScVal = (buf: Buffer | { type: string; data: number[] }) => nativeToScVal(toBuffer(buf), { type: "bytes" });

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
