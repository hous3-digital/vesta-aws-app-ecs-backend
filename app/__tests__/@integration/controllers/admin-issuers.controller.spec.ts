import { BadRequestException } from "@nestjs/common";
import { Keypair } from "@stellar/stellar-sdk";
import { AdminIssuersController } from "@src/infra/auth/admin-issuers.controller";
import type { PrismaService } from "@src/infra/database/@prisma/prisma.service";
import { IssuerDid } from "@src/modules/issuer/domain/issuer-did.value-object";
import { Issuer } from "@src/modules/issuer/domain/issuer.entity";
import { VcService } from "@src/modules/vc/vc.service";
import type { WalletService } from "@src/modules/wallet/wallet.service";
import type { IssuerRegistryService } from "@src/modules/issuer/issuer-registry.service";

describe("issuer identity", () => {
  const stellarAccount = Keypair.random().publicKey();

  it("creates and parses canonical Stellar did:pkh values", () => {
    const testnetDid = IssuerDid.fromStellarAccount(stellarAccount, "testnet");
    const mainnetDid = IssuerDid.fromStellarAccount(stellarAccount, "mainnet");

    expect(testnetDid.value).toBe(`did:pkh:stellar:testnet:${stellarAccount}`);
    expect(testnetDid.method).toBe("pkh");
    expect(testnetDid.network).toBe("testnet");
    expect(testnetDid.account).toBe(stellarAccount);
    expect(testnetDid.verificationMethodId).toBe(`${testnetDid.value}#blockchainAccountId`);
    expect(mainnetDid.value).toBe(`did:pkh:stellar:pubnet:${stellarAccount}`);
  });

  it.each([
    "did:stellar:testnet:GINVALID",
    "did:pkh:stellar:custom:GINVALID",
    "did:pkh:stellar:testnet:GINVALID",
    `did:pkh:stellar:testnet:${stellarAccount}#key-1`,
  ])("rejects an unsupported or malformed canonical DID: %s", (value) => {
    expect(() => IssuerDid.parse(value)).toThrow();
  });

  it("models multiple roles and registry readiness without changing the internal ID", () => {
    const did = IssuerDid.fromStellarAccount(stellarAccount, "testnet");
    const issuer = Issuer.restore({
      id: "issuer_internal",
      externalId: "issuer_a",
      name: "Issuer A",
      status: "active",
      publicKey: null,
      privyEnabled: false,
      did,
      roles: ["TECHNICAL", "COMMERCIAL", "TECHNICAL"],
      authorizedCredentialTypes: ["VestaKYCCredential", "VestaKYCCredential"],
      registryStatus: "REGISTERED",
      createdAt: new Date("2026-09-07T00:00:00.000Z"),
    });

    expect(issuer.externalId).toBe("issuer_a");
    expect(issuer.roles).toEqual(["TECHNICAL", "COMMERCIAL"]);
    expect(issuer.hasRole("TECHNICAL")).toBe(true);
    expect(issuer.canIssueCredentialType("VestaKYCCredential")).toBe(true);
    expect(issuer.isRegistryReady()).toBe(true);
  });

  it("uses the persisted DID and its verification method in newly issued VCs", async () => {
    const did = IssuerDid.fromStellarAccount(stellarAccount, "testnet");
    const service = new VcService();
    jest.spyOn(service, "hashCpf").mockResolvedValue("cpf_hash");
    jest.spyOn(service, "hashBirthDate").mockResolvedValue("birth_hash");
    jest.spyOn(service, "hashFullName").mockResolvedValue("name_hash");

    const result = await service.generateVC({
      cpf: "12345678900",
      fullName: "Pessoa Teste",
      birthDate: "1990-01-01",
      kycLevel: "basic",
      kycMethod: "document",
      issuerId: "issuer_a",
      issuerName: "Issuer A",
      issuerDid: did.value,
      issuerVerificationMethod: did.verificationMethodId,
      nationality: "BR",
    });

    expect(result.vc.issuer.id).toBe(did.value);
    expect(result.vc.proof.verificationMethod).toBe(did.verificationMethodId);
  });

  it("keeps the legacy did:web fallback for an issuer not migrated yet", async () => {
    const service = new VcService();
    jest.spyOn(service, "hashCpf").mockResolvedValue("cpf_hash");
    jest.spyOn(service, "hashBirthDate").mockResolvedValue("birth_hash");
    jest.spyOn(service, "hashFullName").mockResolvedValue("name_hash");

    const result = await service.generateVC({
      cpf: "12345678900",
      fullName: "Pessoa Teste",
      birthDate: "1990-01-01",
      kycLevel: "basic",
      kycMethod: "document",
      issuerId: "issuer_legacy",
      issuerName: "Issuer Legacy",
      nationality: "BR",
    });

    expect(result.vc.issuer.id).toBe("did:web:vesta.id:issuers:issuer_legacy");
    expect(result.vc.proof.verificationMethod).toBe("did:web:vesta.id:issuers:issuer_legacy#key-1");
  });
});

describe("admin issuer identity", () => {
  it("requires an explicit role for new participants and persists a DID after wallet provisioning", async () => {
    const stellarAccount = Keypair.random().publicKey();
    const issuerRecord = {
      id: "issuer_internal",
      issuerId: "issuer_a",
      name: "Issuer A",
      status: "active",
      publicKey: null,
      privyEnabled: false,
      did: null,
      roles: ["TECHNICAL"],
      authorizedCredentialTypes: ["VestaKYCCredential"],
      registryStatus: "UNREGISTERED",
      createdAt: new Date("2026-09-07T00:00:00.000Z"),
    };
    const prisma = {
      issuer: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(issuerRecord),
      },
    } as unknown as PrismaService;
    const wallet = {
      provisionForOrganization: jest.fn().mockResolvedValue({
        address: stellarAccount,
        network: "testnet",
        status: "ACTIVE",
      }),
    } as unknown as WalletService;
    const controller = new AdminIssuersController(prisma, wallet, {} as IssuerRegistryService);

    await expect(controller.createIssuer({ name: "Issuer sem papel", roles: [] })).rejects.toBeInstanceOf(
      BadRequestException,
    );

    const result = await controller.createIssuer({
      issuerId: "issuer_a",
      name: "Issuer A",
      roles: ["TECHNICAL", "TECHNICAL"],
      authorizedCredentialTypes: ["VestaKYCCredential"],
    });

    expect(result.did).toBe(`did:pkh:stellar:testnet:${stellarAccount}`);
    expect(result.roles).toEqual(["TECHNICAL"]);
  });
});
