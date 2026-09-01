import { Networks } from "@stellar/stellar-sdk";
import {
  brlToAtomicUnits,
  deriveCustomContractId,
  loadDeploymentConfig,
  resolveNetworkPassphrase,
} from "@src/scripts/deploy-payout-vault";

describe("payout vault deployment", () => {
  const vestaAddress = "GDUFIQROJ7CMF5AW3EGGG3LSB6QP5M5ASKL62HBX5TAR4ZNQWYQQI5ZK";

  it("deriva de forma determinística o contrato de staging", () => {
    expect(deriveCustomContractId(vestaAddress, Networks.TESTNET)).toBe(
      "CAF4HZZDURUQHYIOCW4LMDMJI4T6RKEJV62OK7FI3H64K5Z5WHBSWEWI",
    );
  });

  it.each([
    ["1000", 10_000_000_000n],
    ["1.37", 13_700_000n],
    ["0.01", 100_000n],
  ])("converte %s BRL para unidades atômicas", (value, expected) => {
    expect(brlToAtomicUnits(value)).toBe(expected);
  });

  it.each(["0", "-1", "1.001", "R$ 1"])("rejeita valor de financiamento inválido: %s", (value) => {
    expect(() => brlToAtomicUnits(value)).toThrow();
  });

  it.each([
    ["testnet", Networks.TESTNET],
    [Networks.TESTNET, Networks.TESTNET],
    ["mainnet", Networks.PUBLIC],
    ["public", Networks.PUBLIC],
    [Networks.PUBLIC, Networks.PUBLIC],
  ])("normaliza a rede %s para a passphrase correta", (value, expected) => {
    expect(resolveNetworkPassphrase(value)).toBe(expected);
  });

  it("rejeita apelido de rede desconhecido antes de assinar", () => {
    expect(() => resolveNetworkPassphrase("staging")).toThrow("STELLAR_NETWORK inválido");
  });

  it("carrega a configuração operacional sem embutir valores secretos no código", () => {
    expect(
      loadDeploymentConfig({
        STELLAR_PAYOUT_ASSET_CODE: "BRL",
        STELLAR_PAYOUT_ASSET_ISSUER: vestaAddress,
        VESTA_DEPLOYER_SECRET: "secret-from-runtime",
        STELLAR_NETWORK: Networks.TESTNET,
        STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
      }),
    ).toMatchObject({
      assetCode: "BRL",
      assetIssuer: vestaAddress,
      deployerSecret: "secret-from-runtime",
      fundingBrl: "1000",
      networkPassphrase: Networks.TESTNET,
    });
  });
});
