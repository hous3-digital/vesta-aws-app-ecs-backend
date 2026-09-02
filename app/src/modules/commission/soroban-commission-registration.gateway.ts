import { Injectable, Logger } from "@nestjs/common";
import { EnvService } from "@src/infra/env/env.service";
import {
  BASE_FEE,
  Contract,
  Keypair,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  rpc as SorobanRpc,
} from "@stellar/stellar-sdk";
import {
  CommissionRegistrationGateway,
  type CommissionRegistrationReconciliationResult,
  CommissionRegistrationRejectedError,
  type CommissionRegistrationResult,
  CommissionRegistrationUnknownError,
  type RegisterCommissionParams,
} from "@src/modules/commission/commission-registration.gateway";

interface OnChainCredit {
  amount: bigint | number | string;
  beneficiary_id: Buffer | Uint8Array | string;
}

@Injectable()
export class SorobanCommissionRegistrationGateway implements CommissionRegistrationGateway {
  private readonly logger = new Logger(SorobanCommissionRegistrationGateway.name);
  private readonly server: SorobanRpc.Server;

  public constructor(private readonly env: EnvService) {
    this.server = new SorobanRpc.Server(env.STELLAR_RPC_URL);
  }

  public async register(params: RegisterCommissionParams): Promise<CommissionRegistrationResult> {
    this.validate(params);
    const { contractId, operator } = this.configuration();
    const existing = await this.readCredit(contractId, operator, params.creditId);
    if (existing) {
      if (
        this.bytesToHex(existing.beneficiary_id) !== params.beneficiaryId.toLowerCase() ||
        BigInt(existing.amount) !== params.amountAtomic
      ) {
        throw new CommissionRegistrationRejectedError(
          "CREDIT_MISMATCH",
          "O identificador da comissão já existe on-chain com outros dados",
        );
      }
      return { txHash: null, ledger: null, recovered: true };
    }

    const account = await this.loadOperatorAccount(operator);
    const contract = new Contract(contractId);
    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.env.STELLAR_NETWORK,
    })
      .addOperation(
        contract.call(
          "credit",
          nativeToScVal(Buffer.from(params.creditId, "hex"), { type: "bytes" }),
          nativeToScVal(Buffer.from(params.beneficiaryId, "hex"), { type: "bytes" }),
          nativeToScVal(params.amountAtomic, { type: "i128" }),
        ),
      )
      .setTimeout(60)
      .build();

    let prepared;
    try {
      prepared = await this.server.prepareTransaction(transaction);
    } catch {
      throw new CommissionRegistrationRejectedError("CREDIT_PREFLIGHT_FAILED", "Preflight do registro on-chain falhou");
    }
    prepared.sign(operator);

    let submitted: Awaited<ReturnType<SorobanRpc.Server["sendTransaction"]>>;
    try {
      submitted = await this.server.sendTransaction(prepared);
    } catch {
      throw new CommissionRegistrationUnknownError("Não foi possível determinar se o crédito foi recebido pela rede");
    }
    if (submitted.status === "ERROR") {
      throw new CommissionRegistrationRejectedError("CONTRACT_REJECTED", "O contrato rejeitou o crédito");
    }

    const txHash = submitted.hash;
    this.logger.log(`Comissão ${params.creditId.slice(0, 12)} enviada: ${txHash}`);
    for (let attempt = 1; attempt <= 20; attempt++) {
      await new Promise<void>((resolve) => setTimeout(resolve, 1_500));
      const result = await this.server.getTransaction(txHash);
      if (result.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
        return { txHash, ledger: result.ledger, recovered: false };
      }
      if (result.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
        throw new CommissionRegistrationRejectedError("CREDIT_FAILED_ON_CHAIN", "O crédito falhou on-chain");
      }
    }
    throw new CommissionRegistrationUnknownError("A confirmação do crédito excedeu o tempo limite", txHash);
  }

  public async reconcile(txHash: string): Promise<CommissionRegistrationReconciliationResult> {
    try {
      const result = await this.server.getTransaction(txHash);
      if (result.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
        return { status: "CONFIRMED", ledger: result.ledger };
      }
      if (result.status === SorobanRpc.Api.GetTransactionStatus.FAILED) return { status: "FAILED" };
      return { status: "PENDING" };
    } catch {
      return { status: "PENDING" };
    }
  }

  private configuration(): { contractId: string; operator: Keypair } {
    const contractId = this.env.STELLAR_PAYOUT_CONTRACT_ID;
    const operatorSecret = this.env.STELLAR_PAYOUT_OPERATOR_SECRET;
    if (contractId === "PLACEHOLDER" || !operatorSecret) {
      throw new CommissionRegistrationRejectedError(
        "REGISTRY_NOT_CONFIGURED",
        "Registro de comissões on-chain ainda não está configurado",
      );
    }
    return { contractId, operator: Keypair.fromSecret(operatorSecret) };
  }

  private async loadOperatorAccount(operator: Keypair) {
    try {
      return await this.server.getAccount(operator.publicKey());
    } catch {
      throw new CommissionRegistrationRejectedError("OPERATOR_ACCOUNT_UNAVAILABLE", "Conta operadora indisponível");
    }
  }

  private async readCredit(contractId: string, operator: Keypair, creditId: string): Promise<OnChainCredit | null> {
    const account = await this.loadOperatorAccount(operator);
    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.env.STELLAR_NETWORK,
    })
      .addOperation(
        new Contract(contractId).call("get_credit", nativeToScVal(Buffer.from(creditId, "hex"), { type: "bytes" })),
      )
      .setTimeout(60)
      .build();
    const simulation = await this.server.simulateTransaction(transaction);
    if (SorobanRpc.Api.isSimulationError(simulation)) return null;
    const value = simulation.result?.retval;
    if (!value) return null;
    return (scValToNative(value) as OnChainCredit | null) ?? null;
  }

  private validate(params: RegisterCommissionParams): void {
    if (!/^[a-f0-9]{64}$/i.test(params.creditId) || !/^[a-f0-9]{64}$/i.test(params.beneficiaryId)) {
      throw new Error("Identificador on-chain da comissão inválido");
    }
    if (params.amountAtomic <= 0n) throw new Error("Valor on-chain da comissão inválido");
  }

  private bytesToHex(value: Buffer | Uint8Array | string): string {
    if (typeof value === "string")
      return /^[a-f0-9]{64}$/i.test(value) ? value.toLowerCase() : Buffer.from(value).toString("hex");
    return Buffer.from(value).toString("hex");
  }
}
