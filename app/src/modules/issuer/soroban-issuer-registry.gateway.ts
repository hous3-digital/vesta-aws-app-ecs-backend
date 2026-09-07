import { Injectable, Logger } from "@nestjs/common";
import { EnvService } from "@src/infra/env/env.service";
import {
  IssuerRegistryGateway,
  IssuerRegistryUnavailableError,
  type RegisterOrUpdateParticipantParams,
  type RegistryCommissionTerm,
  type RegistryIssuerRole,
  type RegistryMutationResult,
  type RegistryParticipant,
  type RegistryParticipantStatus,
} from "@src/modules/issuer/issuer-registry.gateway";
import {
  BASE_FEE,
  Contract,
  Keypair,
  TransactionBuilder,
  nativeToScVal,
  rpc as SorobanRpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";

type RegistryContractRole = "Technical" | "Commercial";
type RegistryContractStatus = "Active" | "Suspended";

interface NativeRegistryParticipant {
  did: string;
  roles: unknown[];
  payout_address: string;
  commission_terms: Array<{ role: unknown; share_bps: number | bigint }>;
  authorized_credential_types: string[];
  status: unknown;
  registered_at: number | bigint;
  updated_at: number | bigint;
}

@Injectable()
export class SorobanIssuerRegistryGateway implements IssuerRegistryGateway {
  private readonly logger = new Logger(SorobanIssuerRegistryGateway.name);
  private readonly server: SorobanRpc.Server;

  public constructor(private readonly env: EnvService) {
    this.server = new SorobanRpc.Server(env.STELLAR_RPC_URL);
  }

  public async getParticipant(did: string): Promise<RegistryParticipant | null> {
    const { contractId, admin } = this.configuration();
    const account = await this.loadAdminAccount(admin);
    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.env.STELLAR_NETWORK,
    })
      .addOperation(new Contract(contractId).call("get_participant", nativeToScVal(did, { type: "string" })))
      .setTimeout(60)
      .build();

    let simulation: Awaited<ReturnType<SorobanRpc.Server["simulateTransaction"]>>;
    try {
      simulation = await this.server.simulateTransaction(transaction);
    } catch {
      throw new IssuerRegistryUnavailableError("REGISTRY_RPC_UNAVAILABLE", "Issuer registry indisponível");
    }
    if (SorobanRpc.Api.isSimulationError(simulation)) {
      throw new IssuerRegistryUnavailableError("REGISTRY_QUERY_FAILED", "Consulta ao issuer registry falhou");
    }

    const retval = simulation.result?.retval;
    if (!retval) {
      throw new IssuerRegistryUnavailableError("REGISTRY_QUERY_EMPTY", "Issuer registry retornou resposta inválida");
    }
    const native = scValToNative(retval) as NativeRegistryParticipant | null;
    return native ? decodeRegistryParticipant(native) : null;
  }

  public async registerOrUpdate(params: RegisterOrUpdateParticipantParams): Promise<RegistryMutationResult> {
    const { contractId, admin } = this.configuration();
    const existing = await this.getParticipant(params.did);
    const operation = existing ? "UPDATED" : "REGISTERED";
    const functionName = existing ? "update_participant" : "register_participant";
    const contract = new Contract(contractId);
    const account = await this.loadAdminAccount(admin);
    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.env.STELLAR_NETWORK,
    })
      .addOperation(
        contract.call(
          functionName,
          nativeToScVal(params.did, { type: "string" }),
          encodeRoles(params.roles),
          nativeToScVal(params.payoutAddress, { type: "address" }),
          encodeCommissionTerms(params.commissionTerms),
          nativeToScVal(params.authorizedCredentialTypes, { type: "string" }),
        ),
      )
      .setTimeout(60)
      .build();

    let prepared;
    try {
      prepared = await this.server.prepareTransaction(transaction);
    } catch {
      throw new IssuerRegistryUnavailableError(
        "REGISTRY_PREFLIGHT_FAILED",
        "Preflight da atualização do issuer registry falhou",
      );
    }
    prepared.sign(admin);

    let submitted: Awaited<ReturnType<SorobanRpc.Server["sendTransaction"]>>;
    try {
      submitted = await this.server.sendTransaction(prepared);
    } catch {
      throw new IssuerRegistryUnavailableError(
        "REGISTRY_SUBMISSION_UNKNOWN",
        "Não foi possível determinar se a transação do issuer registry chegou à rede",
      );
    }
    if (submitted.status === "ERROR") {
      throw new IssuerRegistryUnavailableError("REGISTRY_CONTRACT_REJECTED", "Issuer registry rejeitou a mutação");
    }

    const txHash = submitted.hash;
    this.logger.log(`Issuer registry ${operation.toLowerCase()} para ${params.did.slice(0, 32)}...: ${txHash}`);
    for (let attempt = 1; attempt <= 20; attempt++) {
      await new Promise<void>((resolve) => setTimeout(resolve, 1_500));
      let result: Awaited<ReturnType<SorobanRpc.Server["getTransaction"]>>;
      try {
        result = await this.server.getTransaction(txHash);
      } catch {
        // Uma indisponibilidade transitória durante o polling não transforma uma
        // transação possivelmente confirmada em falha. Continuamos até o timeout,
        // que mantém o estado local sem confirmação e conserva o hash para suporte.
        continue;
      }
      if (result.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
        const participant = await this.getParticipant(params.did);
        if (!participant) {
          throw new IssuerRegistryUnavailableError(
            "REGISTRY_CONFIRMATION_MISMATCH",
            "Transação confirmada sem participante resolvível no issuer registry",
            txHash,
          );
        }
        return { operation, participant, txHash, ledger: result.ledger };
      }
      if (result.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
        throw new IssuerRegistryUnavailableError(
          "REGISTRY_TRANSACTION_FAILED",
          "Mutação do issuer registry falhou on-chain",
          txHash,
        );
      }
    }
    throw new IssuerRegistryUnavailableError(
      "REGISTRY_CONFIRMATION_TIMEOUT",
      "Confirmação da mutação do issuer registry excedeu o tempo limite",
      txHash,
    );
  }

  private configuration(): { contractId: string; admin: Keypair } {
    const contractId = this.env.STELLAR_ISSUER_REGISTRY_CONTRACT_ID;
    const adminSecret = this.env.VESTA_DEPLOYER_SECRET;
    if (contractId === "PLACEHOLDER" || !adminSecret) {
      throw new IssuerRegistryUnavailableError("REGISTRY_NOT_CONFIGURED", "Issuer registry ainda não está configurado");
    }
    try {
      return { contractId, admin: Keypair.fromSecret(adminSecret) };
    } catch {
      throw new IssuerRegistryUnavailableError("REGISTRY_ADMIN_INVALID", "Autoridade do issuer registry inválida");
    }
  }

  private async loadAdminAccount(admin: Keypair) {
    try {
      return await this.server.getAccount(admin.publicKey());
    } catch {
      throw new IssuerRegistryUnavailableError(
        "REGISTRY_ADMIN_ACCOUNT_UNAVAILABLE",
        "Conta da autoridade do issuer registry indisponível",
      );
    }
  }
}

export function encodeRoles(roles: RegistryIssuerRole[]): xdr.ScVal {
  return xdr.ScVal.scvVec(roles.map((role) => encodeUnionVariant(toContractRole(role))));
}

export function encodeCommissionTerms(terms: RegistryCommissionTerm[]): xdr.ScVal {
  return xdr.ScVal.scvVec(
    terms.map((term) =>
      encodeStruct({
        role: encodeUnionVariant(toContractRole(term.role)),
        share_bps: nativeToScVal(term.shareBps, { type: "u32" }),
      }),
    ),
  );
}

export function decodeRegistryParticipant(native: NativeRegistryParticipant): RegistryParticipant {
  return {
    did: native.did,
    roles: native.roles.map((role) => fromContractRole(readUnionVariant(role) as RegistryContractRole)),
    payoutAddress: native.payout_address,
    commissionTerms: native.commission_terms.map((term) => ({
      role: fromContractRole(readUnionVariant(term.role) as RegistryContractRole),
      shareBps: Number(term.share_bps),
    })),
    authorizedCredentialTypes: native.authorized_credential_types,
    status: fromContractStatus(readUnionVariant(native.status) as RegistryContractStatus),
    registeredAt: Number(native.registered_at),
    updatedAt: Number(native.updated_at),
  };
}

function encodeUnionVariant(value: string): xdr.ScVal {
  return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(value)]);
}

function encodeStruct(fields: Record<string, xdr.ScVal>): xdr.ScVal {
  const entries = Object.entries(fields)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([name, value]) =>
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol(name),
          val: value,
        }),
    );
  return xdr.ScVal.scvMap(entries);
}

function readUnionVariant(value: unknown): string {
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  if (typeof value === "string") return value;
  throw new IssuerRegistryUnavailableError("REGISTRY_INVALID_RESPONSE", "Issuer registry retornou enum inválido");
}

function toContractRole(role: RegistryIssuerRole): RegistryContractRole {
  return role === "TECHNICAL" ? "Technical" : "Commercial";
}

function fromContractRole(role: RegistryContractRole): RegistryIssuerRole {
  if (role === "Technical") return "TECHNICAL";
  if (role === "Commercial") return "COMMERCIAL";
  throw new IssuerRegistryUnavailableError("REGISTRY_INVALID_RESPONSE", "Issuer registry retornou papel inválido");
}

function fromContractStatus(status: RegistryContractStatus): RegistryParticipantStatus {
  if (status === "Active") return "ACTIVE";
  if (status === "Suspended") return "SUSPENDED";
  throw new IssuerRegistryUnavailableError("REGISTRY_INVALID_RESPONSE", "Issuer registry retornou status inválido");
}
