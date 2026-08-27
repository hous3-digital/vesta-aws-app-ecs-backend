import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  Address,
  Asset,
  BASE_FEE,
  Contract,
  hash,
  Keypair,
  nativeToScVal,
  Operation,
  scValToNative,
  StrKey,
  TransactionBuilder,
  xdr,
  rpc as SorobanRpc,
} from "@stellar/stellar-sdk";

export const PAYOUT_VAULT_SALT = createHash("sha256").update("vesta-payout-vault:v1").digest();
export const DEFAULT_FUNDING_BRL = "1000";

interface DeploymentConfig {
  assetCode: string;
  assetIssuer: string;
  deployerSecret: string;
  fundingBrl: string;
  networkPassphrase: string;
  rpcUrl: string;
  wasmPath: string;
}

interface VaultConfig {
  admin: string;
  guardian: string;
  operator: string;
  paused: boolean;
  token: string;
}

interface TransactionResult {
  hash: string;
  returnValue?: xdr.ScVal;
}

export function deriveCustomContractId(
  deployerAddress: string,
  networkPassphrase: string,
  salt = PAYOUT_VAULT_SALT,
): string {
  const contractIdPreimage = xdr.ContractIdPreimage.contractIdPreimageFromAddress(
    new xdr.ContractIdPreimageFromAddress({
      address: Address.fromString(deployerAddress).toScAddress(),
      salt,
    }),
  );
  const preimage = xdr.HashIdPreimage.envelopeTypeContractId(
    new xdr.HashIdPreimageContractId({
      networkId: hash(Buffer.from(networkPassphrase)),
      contractIdPreimage,
    }),
  );
  return StrKey.encodeContract(hash(preimage.toXDR()));
}

export function brlToAtomicUnits(value: string, decimals = 7): bigint {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    throw new Error("PAYOUT_VAULT_FUNDING_BRL deve ser um valor positivo com no máximo duas casas decimais");
  }
  const [whole, fraction = ""] = value.split(".");
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (minor <= 0n) throw new Error("PAYOUT_VAULT_FUNDING_BRL deve ser maior que zero");
  return minor * 10n ** BigInt(decimals - 2);
}

export function loadDeploymentConfig(env: Record<string, string | undefined> = process.env): DeploymentConfig {
  const required = (name: string): string => {
    const value = env[name]?.trim();
    if (!value) throw new Error(`${name} não configurado`);
    return value;
  };
  return {
    assetCode: required("STELLAR_PAYOUT_ASSET_CODE"),
    assetIssuer: required("STELLAR_PAYOUT_ASSET_ISSUER"),
    deployerSecret: required("VESTA_DEPLOYER_SECRET"),
    fundingBrl: env.PAYOUT_VAULT_FUNDING_BRL?.trim() || DEFAULT_FUNDING_BRL,
    networkPassphrase: required("STELLAR_NETWORK"),
    rpcUrl: required("STELLAR_RPC_URL"),
    wasmPath:
      env.PAYOUT_VAULT_WASM_PATH?.trim() || join(process.cwd(), "contract-artifacts", "vesta_payout_vault.wasm"),
  };
}

export class PayoutVaultDeployer {
  private readonly server: SorobanRpc.Server;
  private readonly deployer: Keypair;
  private readonly asset: Asset;
  private readonly assetContractId: string;
  private readonly vaultContractId: string;

  public constructor(private readonly config: DeploymentConfig) {
    this.server = new SorobanRpc.Server(config.rpcUrl);
    this.deployer = Keypair.fromSecret(config.deployerSecret);
    if (this.deployer.publicKey() !== config.assetIssuer) {
      throw new Error("VESTA_DEPLOYER_SECRET não corresponde ao STELLAR_PAYOUT_ASSET_ISSUER configurado");
    }
    this.asset = new Asset(config.assetCode, config.assetIssuer);
    this.assetContractId = this.asset.contractId(config.networkPassphrase);
    this.vaultContractId = deriveCustomContractId(this.deployer.publicKey(), config.networkPassphrase);
  }

  public async deploy(): Promise<{
    assetContractId: string;
    contractId: string;
    fundedAtomic: string;
    operatorAddress: string;
  }> {
    const wasm = await readFile(this.config.wasmPath);
    const wasmHash = createHash("sha256").update(wasm).digest();

    await this.ensureWasmUploaded(wasm, wasmHash);
    await this.ensureAssetContract();
    await this.ensureVaultContract(wasmHash);
    await this.ensureInitialized();
    const fundedAtomic = await this.ensureFunded(brlToAtomicUnits(this.config.fundingBrl));

    return {
      assetContractId: this.assetContractId,
      contractId: this.vaultContractId,
      fundedAtomic: fundedAtomic.toString(),
      operatorAddress: this.deployer.publicKey(),
    };
  }

  private async ensureWasmUploaded(wasm: Buffer, wasmHash: Buffer): Promise<void> {
    try {
      await this.server.getContractWasmByHash(wasmHash);
      return;
    } catch (cause) {
      if (!this.isNotFound(cause)) throw cause;
    }
    await this.sendOperation(Operation.uploadContractWasm({ wasm }));
  }

  private async ensureAssetContract(): Promise<void> {
    if (await this.contractExists(this.assetContractId)) return;
    await this.sendOperation(Operation.createStellarAssetContract({ asset: this.asset }));
  }

  private async ensureVaultContract(wasmHash: Buffer): Promise<void> {
    if (await this.contractExists(this.vaultContractId)) return;
    await this.sendOperation(
      Operation.createCustomContract({
        address: Address.fromString(this.deployer.publicKey()),
        salt: PAYOUT_VAULT_SALT,
        wasmHash,
      }),
    );
    if (!(await this.contractExists(this.vaultContractId))) {
      throw new Error("Contrato do cofre não foi encontrado após o deployment");
    }
  }

  private async ensureInitialized(): Promise<void> {
    const current = await this.readVaultConfig();
    const expectedAddress = this.deployer.publicKey();
    if (current) {
      if (
        current.admin !== expectedAddress ||
        current.guardian !== expectedAddress ||
        current.operator !== expectedAddress ||
        current.token !== this.assetContractId ||
        current.paused
      ) {
        throw new Error("O cofre já existe com uma configuração diferente da esperada para staging");
      }
      return;
    }

    const contract = new Contract(this.vaultContractId);
    await this.sendOperation(
      contract.call(
        "initialize",
        nativeToScVal(expectedAddress, { type: "address" }),
        nativeToScVal(expectedAddress, { type: "address" }),
        nativeToScVal(expectedAddress, { type: "address" }),
        nativeToScVal(this.assetContractId, { type: "address" }),
      ),
    );

    if (!(await this.readVaultConfig())) {
      throw new Error("O cofre foi implantado, mas não respondeu como inicializado");
    }
  }

  private async ensureFunded(targetAtomic: bigint): Promise<bigint> {
    const current = await this.readTokenBalance(this.vaultContractId);
    if (current >= targetAtomic) return current;

    // A conta emissora não possui saldo do próprio ativo clássico. Como ela
    // também é a administradora do SAC, o financiamento inicial deve ser feito
    // por mint diretamente para o cofre.
    const contract = new Contract(this.assetContractId);
    await this.sendOperation(
      contract.call(
        "mint",
        nativeToScVal(this.vaultContractId, { type: "address" }),
        nativeToScVal(targetAtomic - current, { type: "i128" }),
      ),
    );
    const funded = await this.readTokenBalance(this.vaultContractId);
    if (funded < targetAtomic) throw new Error("Saldo do cofre permaneceu abaixo do valor solicitado");
    return funded;
  }

  private async readVaultConfig(): Promise<VaultConfig | null> {
    const value = await this.simulateContractCall(new Contract(this.vaultContractId).call("get_config"));
    if (!value) return null;
    return scValToNative(value) as VaultConfig;
  }

  private async readTokenBalance(address: string): Promise<bigint> {
    const value = await this.simulateContractCall(
      new Contract(this.assetContractId).call("balance", nativeToScVal(address, { type: "address" })),
    );
    if (!value) throw new Error("Não foi possível consultar o saldo BRL do cofre");
    return BigInt(scValToNative(value));
  }

  private async simulateContractCall(operation: xdr.Operation): Promise<xdr.ScVal | null> {
    const account = await this.server.getAccount(this.deployer.publicKey());
    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(60)
      .build();
    const simulation = await this.server.simulateTransaction(transaction);
    if (SorobanRpc.Api.isSimulationError(simulation)) return null;
    return simulation.result?.retval ?? null;
  }

  private async contractExists(contractId: string): Promise<boolean> {
    try {
      await this.server.getContractData(
        contractId,
        xdr.ScVal.scvLedgerKeyContractInstance(),
        SorobanRpc.Durability.Persistent,
      );
      return true;
    } catch (cause) {
      if (this.isNotFound(cause)) return false;
      throw cause;
    }
  }

  private async sendOperation(operation: xdr.Operation): Promise<TransactionResult> {
    const account = await this.server.getAccount(this.deployer.publicKey());
    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(60)
      .build();
    const prepared = await this.server.prepareTransaction(transaction);
    prepared.sign(this.deployer);
    const submitted = await this.server.sendTransaction(prepared);
    if (submitted.status === "ERROR") {
      throw new Error(`A Stellar rejeitou a transação de deployment: ${submitted.errorResult?.toXDR("base64")}`);
    }

    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise<void>((resolve) => setTimeout(resolve, 2_000));
      const result = await this.server.getTransaction(submitted.hash);
      if (result.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
        return { hash: submitted.hash, returnValue: result.returnValue };
      }
      if (result.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
        throw new Error(`Transação de deployment falhou on-chain: ${submitted.hash}`);
      }
    }
    throw new Error(`Confirmação do deployment excedeu o tempo limite: ${submitted.hash}`);
  }

  private isNotFound(cause: unknown): boolean {
    return typeof cause === "object" && cause !== null && "code" in cause && (cause as { code?: unknown }).code === 404;
  }
}

async function main(): Promise<void> {
  const result = await new PayoutVaultDeployer(loadDeploymentConfig()).deploy();
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (require.main === module) {
  void main().catch((cause: unknown) => {
    const message = cause instanceof Error ? cause.message : "Falha desconhecida no deployment";
    process.stderr.write(`Payout vault deployment failed: ${message}\n`);
    process.exitCode = 1;
  });
}
