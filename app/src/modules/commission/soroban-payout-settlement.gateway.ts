import { Injectable, Logger } from "@nestjs/common";
import { EnvService } from "@src/infra/env/env.service";
import {
  BASE_FEE,
  Contract,
  Keypair,
  TransactionBuilder,
  nativeToScVal,
  rpc as SorobanRpc,
} from "@stellar/stellar-sdk";
import {
  PayoutSettlementGateway,
  type PayoutReconciliationResult,
  type PayoutSettlementResult,
  type SettlePayoutParams,
  SettlementUnknownError,
  SettlementRejectedError,
} from "@src/modules/commission/payout-settlement.gateway";

@Injectable()
export class SorobanPayoutSettlementGateway implements PayoutSettlementGateway {
  private readonly logger = new Logger(SorobanPayoutSettlementGateway.name);
  private readonly server: SorobanRpc.Server;

  public constructor(private readonly env: EnvService) {
    this.server = new SorobanRpc.Server(env.STELLAR_RPC_URL);
  }

  public async settle(params: SettlePayoutParams): Promise<PayoutSettlementResult> {
    const contractId = this.env.STELLAR_PAYOUT_CONTRACT_ID;
    const operatorSecret = this.env.STELLAR_PAYOUT_OPERATOR_SECRET;
    if (contractId === "PLACEHOLDER" || !operatorSecret) {
      throw new SettlementRejectedError("SETTLEMENT_NOT_CONFIGURED", "Liquidação on-chain ainda não está configurada");
    }
    if (!/^[a-f0-9]{64}$/i.test(params.payoutId) || !/^[a-f0-9]{64}$/i.test(params.beneficiaryId)) {
      throw new Error("Identificador on-chain de repasse inválido");
    }
    if (params.amountAtomic <= 0n) throw new Error("Valor de liquidação inválido");

    const operator = Keypair.fromSecret(operatorSecret);
    let account;
    try {
      account = await this.server.getAccount(operator.publicKey());
    } catch {
      throw new SettlementRejectedError("OPERATOR_ACCOUNT_UNAVAILABLE", "Conta operadora indisponível");
    }
    const contract = new Contract(contractId);
    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.env.STELLAR_NETWORK,
    })
      .addOperation(
        contract.call(
          "settle",
          nativeToScVal(Buffer.from(params.payoutId, "hex"), { type: "bytes" }),
          nativeToScVal(Buffer.from(params.beneficiaryId, "hex"), { type: "bytes" }),
          nativeToScVal(params.destinationAddress, { type: "address" }),
          nativeToScVal(params.amountAtomic, { type: "i128" }),
        ),
      )
      .setTimeout(60)
      .build();

    let prepared;
    try {
      prepared = await this.server.prepareTransaction(transaction);
    } catch {
      throw new SettlementRejectedError("SETTLEMENT_PREFLIGHT_FAILED", "Preflight da liquidação falhou");
    }
    prepared.sign(operator);

    let submitted: Awaited<ReturnType<SorobanRpc.Server["sendTransaction"]>>;
    try {
      submitted = await this.server.sendTransaction(prepared);
    } catch (cause) {
      throw new SettlementUnknownError(
        `Não foi possível determinar se a transação foi recebida: ${this.safeMessage(cause)}`,
      );
    }
    if (submitted.status === "ERROR") {
      throw new SettlementRejectedError("CONTRACT_REJECTED", "O contrato rejeitou a liquidação");
    }

    const txHash = submitted.hash;
    this.logger.log(`Repasse ${params.payoutId.slice(0, 12)} enviado: ${txHash}`);
    for (let attempt = 1; attempt <= 20; attempt++) {
      await new Promise<void>((resolve) => setTimeout(resolve, 1500));
      const result = await this.server.getTransaction(txHash);
      if (result.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
        return { txHash, ledger: result.ledger };
      }
      if (result.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
        throw new SettlementRejectedError("SETTLEMENT_FAILED_ON_CHAIN", "A liquidação falhou on-chain");
      }
    }
    throw new SettlementUnknownError("A confirmação da liquidação excedeu o tempo limite", txHash);
  }

  public async reconcile(txHash: string): Promise<PayoutReconciliationResult> {
    try {
      const result = await this.server.getTransaction(txHash);
      if (result.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
        return { status: "CONFIRMED", ledger: result.ledger };
      }
      if (result.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
        return { status: "FAILED" };
      }
      return { status: "PENDING" };
    } catch (cause) {
      this.logger.warn(`Falha transitória ao conciliar ${txHash.slice(0, 12)}: ${this.safeMessage(cause)}`);
      return { status: "PENDING" };
    }
  }

  private safeMessage(cause: unknown): string {
    return cause instanceof Error ? cause.message.slice(0, 160) : "erro desconhecido";
  }
}
