import { ConflictException } from "@nestjs/common";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { PasskeyAuthService } from "@src/modules/challenge/passkey-auth.service";
import { Credential } from "@src/modules/credential/domain/credential.entity";

jest.mock("@simplewebauthn/server", () => ({
  generateAuthenticationOptions: jest.fn(async (options) => ({ ...options })),
  generateRegistrationOptions: jest.fn(async (options) => ({ ...options })),
  verifyAuthenticationResponse: jest.fn(),
  verifyRegistrationResponse: jest.fn(),
}));

const vcHash = "ab".repeat(32);
const credential = Credential.issue({
  vcHash,
  cpfDedupKey: null,
  issuerDid: "did:web:vesta.test",
  issuerId: "issuer-1",
  subjectDid: "did:key:holder",
  kycLevel: "complete",
  expiresAt: new Date("2099-01-01T00:00:00.000Z"),
});

describe("PasskeyAuthService", () => {
  const challengeService = {
    generate: jest.fn(),
    consumeContext: jest.fn(),
  };
  const credentialRepository = { findByVcHash: jest.fn() };
  const envService = {
    WEBAUTHN_ALLOWED_ORIGINS: "https://app.example.com",
    WEBAUTHN_ALLOWED_RP_IDS: "app.example.com",
  };
  const prisma = {
    passkeyCredential: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const walletService = {
    isEnabledForIssuer: jest.fn(),
    issueCustomAuthToken: jest.fn(),
  };
  const service = new PasskeyAuthService(
    challengeService as never,
    credentialRepository as never,
    envService as never,
    prisma as never,
    walletService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    credentialRepository.findByVcHash.mockResolvedValue(credential);
  });

  it("impede substituir um Passkey já registrado apenas com API key e vcHash", async () => {
    prisma.passkeyCredential.findUnique.mockResolvedValue({ id: "existing" });
    await expect(
      service.registrationOptions("issuer-1", vcHash, "app.example.com"),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(challengeService.generate).not.toHaveBeenCalled();
  });

  it("só emite token Privy e proof challenge depois de verificar assertion e atualizar counter", async () => {
    challengeService.consumeContext.mockResolvedValue({
      kind: "passkey-authentication",
      issuerId: "issuer-1",
      rpId: "app.example.com",
    });
    challengeService.generate.mockResolvedValue({ challenge: "proof-challenge", expiresAt: Date.now() + 60_000 });
    prisma.passkeyCredential.findUnique.mockResolvedValue({
      id: "passkey-1",
      vcHash,
      issuerId: "issuer-1",
      subjectDid: credential.subjectDid,
      rpId: "app.example.com",
      publicKey: Buffer.from("public-key").toString("base64url"),
      counter: 7,
      transports: ["internal"],
    });
    (verifyAuthenticationResponse as jest.Mock).mockResolvedValue({
      verified: true,
      authenticationInfo: {
        newCounter: 8,
        credentialBackedUp: true,
        credentialDeviceType: "multiDevice",
      },
    });
    walletService.isEnabledForIssuer.mockResolvedValue(true);
    walletService.issueCustomAuthToken.mockResolvedValue({ token: "signed.jwt.value", expiresAt: 123 });
    prisma.passkeyCredential.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.verifyAuthentication({
      issuerId: "issuer-1",
      challenge: "authentication-challenge",
      response: {
        id: "passkey-1",
        response: {
          clientDataJSON: Buffer.from(JSON.stringify({ origin: "https://app.example.com" })).toString("base64url"),
        },
      } as never,
    });

    expect(prisma.passkeyCredential.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ counter: 8 }),
    }));
    expect(walletService.issueCustomAuthToken).toHaveBeenCalledWith(credential.subjectDid);
    expect(result).toEqual({
      verified: true,
      vcHash,
      proofChallenge: "proof-challenge",
      privyCustomAuthToken: "signed.jwt.value",
      expiresAt: 123,
    });
  });
});
