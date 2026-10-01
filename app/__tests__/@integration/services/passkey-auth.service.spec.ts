import { ConflictException } from "@nestjs/common";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import type { PrismaService } from "@src/infra/database/@prisma/prisma.service";
import type { EnvService } from "@src/infra/env/env.service";
import type { ChallengeService } from "@src/modules/challenge/application/services/challenge.service";
import { PasskeyAuthService } from "@src/modules/challenge/application/services/passkey-auth.service";
import { CredentialStatus } from "@src/modules/credential/domain/credential.entity";
import type { WalletService } from "@src/modules/wallet/application/services/wallet.service";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@src/shared/errors";
import { FIXTURE_ISSUER_EXTERNAL_ID } from "@test/constants";
import { credentialModel } from "@test/mocks/model/credential.model";
import { passkeyRecord, RECORDED_ASSERTION } from "@test/mocks/model/passkey.model";
import { mockCredentialRepository } from "@test/mocks/repository/credential.repository.mock";
import { mockChallengeService } from "@test/mocks/service/challenge.service.mock";
import { mockEnvService } from "@test/mocks/service/env.service.mock";
import { mockPrismaService } from "@test/mocks/service/prisma.service.mock";
import { mockWalletService } from "@test/mocks/service/wallet.service.mock";

/**
 * ChallengeService, WalletService and PrismaService are legacy concrete classes (legacy
 * map, `challenge`), cast at the constructor. The two WebAuthn verifiers are mocked;
 * the cases built on RECORDED_ASSERTION run the real one to prove the fixture.
 */
jest.mock("@simplewebauthn/server", () => {
  const actual = jest.requireActual<typeof import("@simplewebauthn/server")>("@simplewebauthn/server");
  return {
    ...actual,
    generateAuthenticationOptions: jest.fn(actual.generateAuthenticationOptions),
    generateRegistrationOptions: jest.fn(actual.generateRegistrationOptions),
    verifyAuthenticationResponse: jest.fn(),
    verifyRegistrationResponse: jest.fn(),
  };
});

const actualWebAuthn = jest.requireActual<typeof import("@simplewebauthn/server")>("@simplewebauthn/server");
const verifyAuthentication = jest.mocked(verifyAuthenticationResponse);
const verifyRegistration = jest.mocked(verifyRegistrationResponse);

const ISSUER_ID = FIXTURE_ISSUER_EXTERNAL_ID;
const VC_HASH = "ab".repeat(32);
const RP_ID = RECORDED_ASSERTION.rpId;
const ORIGIN = RECORDED_ASSERTION.origin;

const makeSut = () => {
  const challengeService = mockChallengeService();
  const credentialRepository = mockCredentialRepository();
  const prisma = mockPrismaService();
  const walletService = mockWalletService();
  const sut = new PasskeyAuthService(
    challengeService as unknown as ChallengeService,
    credentialRepository,
    mockEnvService() as unknown as EnvService,
    prisma as unknown as PrismaService,
    walletService as unknown as WalletService,
  );
  return { sut, challengeService, credentialRepository, prisma, walletService };
};

/** A consumed authentication challenge of the fixture issuer, the given passkey row and its active credential. */
const arrangeAuthentication = (
  { challengeService, credentialRepository, prisma }: ReturnType<typeof makeSut>,
  passkey = passkeyRecord(),
): void => {
  challengeService.consumeContext.mockResolvedValue({
    kind: "passkey-authentication",
    issuerId: ISSUER_ID,
    rpId: RP_ID,
  });
  prisma.passkeyCredential.findFirst.mockResolvedValue(passkey);
  credentialRepository.findByVcHashForIssuerOrThrow.mockResolvedValue(credentialModel({ vcHash: passkey.vcHash }));
};

const authenticate = (sut: PasskeyAuthService, response: AuthenticationResponseJSON = RECORDED_ASSERTION.response) =>
  sut.verifyAuthentication({ issuerId: ISSUER_ID, challenge: RECORDED_ASSERTION.challenge, response });

const verifiedWithCounter = (newCounter: number) =>
  ({
    verified: true,
    authenticationInfo: { newCounter, credentialBackedUp: false, credentialDeviceType: "singleDevice" },
  }) as never;

describe("PasskeyAuthService", () => {
  beforeEach(() => {
    verifyAuthentication.mockReset();
    verifyRegistration.mockReset();
  });

  describe("registrationOptions", () => {
    it("CT-VESTA-PASS-003 refuses registration options when the credential already has a passkey", async () => {
      // Arrange
      const { sut, challengeService, credentialRepository, prisma } = makeSut();
      credentialRepository.findByVcHash.mockResolvedValue(credentialModel({ vcHash: VC_HASH }));
      prisma.passkeyCredential.findUnique.mockResolvedValue(passkeyRecord());

      // Act
      const act = sut.registrationOptions(ISSUER_ID, VC_HASH, RP_ID);

      // Assert
      await expect(act).rejects.toBeInstanceOf(ConflictException);
      expect(challengeService.store).not.toHaveBeenCalled();
    });

    it("stores the Base64URL registration challenge unchanged, bound to issuer, RP ID and credential", async () => {
      // Arrange
      const { sut, challengeService, credentialRepository } = makeSut();
      credentialRepository.findByVcHash.mockResolvedValue(credentialModel({ vcHash: VC_HASH }));

      // Act
      const options = await sut.registrationOptions(ISSUER_ID, VC_HASH, RP_ID);

      // Assert
      expect(challengeService.store).toHaveBeenCalledWith(
        options.challenge,
        { kind: "passkey-registration", issuerId: ISSUER_ID, rpId: RP_ID, vcHash: VC_HASH },
        120,
      );
      expect(generateRegistrationOptions).toHaveBeenCalledWith(expect.objectContaining({ timeout: 60_000 }));
      expect((generateRegistrationOptions as jest.Mock).mock.calls[0][0]).not.toHaveProperty("challenge");
      expect(options.challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe("authenticationOptions", () => {
    it("stores the Base64URL authentication challenge unchanged, bound to issuer and RP ID", async () => {
      // Arrange
      const { sut, challengeService } = makeSut();

      // Act
      const options = await sut.authenticationOptions(ISSUER_ID, RP_ID);

      // Assert
      expect(challengeService.store).toHaveBeenCalledWith(
        options.challenge,
        { kind: "passkey-authentication", issuerId: ISSUER_ID, rpId: RP_ID },
        120,
      );
      expect(generateAuthenticationOptions).toHaveBeenCalledWith(expect.objectContaining({ timeout: 60_000 }));
      expect((generateAuthenticationOptions as jest.Mock).mock.calls[0][0]).not.toHaveProperty("challenge");
      expect(options.challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe("verifyRegistration", () => {
    const registrationContext = {
      kind: "passkey-registration" as const,
      issuerId: ISSUER_ID,
      rpId: RP_ID,
      vcHash: VC_HASH,
    };
    const attestation = {
      id: "cred-1",
      rawId: "cred-1",
      type: "public-key",
      clientExtensionResults: {},
      response: {
        clientDataJSON: Buffer.from(JSON.stringify({ origin: ORIGIN })).toString("base64url"),
        attestationObject: "",
      },
    } satisfies RegistrationResponseJSON;
    const registrationInfo = {
      credential: { id: "cred-1", publicKey: new Uint8Array([1, 2, 3]), counter: 0, transports: ["internal"] },
      credentialDeviceType: "multiDevice",
      credentialBackedUp: true,
    };
    const register = (sut: PasskeyAuthService, response: RegistrationResponseJSON = attestation) =>
      sut.verifyRegistration({ issuerId: ISSUER_ID, challenge: "registration-challenge", response });

    it("persists the passkey with the id, public key and counter the library attested", async () => {
      // Arrange
      const { sut, challengeService, credentialRepository, prisma } = makeSut();
      challengeService.consumeContext.mockResolvedValue(registrationContext);
      credentialRepository.findByVcHashForIssuerOrThrow.mockResolvedValue(credentialModel({ vcHash: VC_HASH }));
      verifyRegistration.mockResolvedValue({ verified: true, registrationInfo } as never);

      // Act
      const result = await register(sut);

      // Assert
      expect(result).toEqual({ verified: true, passkeyCredentialId: "cred-1", vcHash: VC_HASH });
      expect(prisma.passkeyCredential.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: "cred-1",
          vcHash: VC_HASH,
          issuerId: ISSUER_ID,
          rpId: RP_ID,
          counter: 0,
          publicKey: Buffer.from([1, 2, 3]).toString("base64url"),
        }),
      });
    });

    it("CT-VESTA-PASS-004 answers 400 PASSKEY_VERIFICATION_FAILED and creates nothing when the library rejects the attestation", async () => {
      // Arrange
      const { sut, challengeService, credentialRepository, prisma } = makeSut();
      challengeService.consumeContext.mockResolvedValue(registrationContext);
      credentialRepository.findByVcHashForIssuerOrThrow.mockResolvedValue(credentialModel({ vcHash: VC_HASH }));
      verifyRegistration.mockRejectedValue(new Error("Unexpected registration response origin"));

      // Act
      const act = register(sut);

      // Assert
      await expect(act).rejects.toBeInstanceOf(ValidationError);
      await expect(act).rejects.toMatchObject({ code: "PASSKEY_VERIFICATION_FAILED" });
      expect(prisma.passkeyCredential.create).not.toHaveBeenCalled();
    });

    it("CT-VESTA-PASS-004 answers 400 PASSKEY_VERIFICATION_FAILED and creates nothing when the attestation comes back unverified", async () => {
      // Arrange
      const { sut, challengeService, credentialRepository, prisma } = makeSut();
      challengeService.consumeContext.mockResolvedValue(registrationContext);
      credentialRepository.findByVcHashForIssuerOrThrow.mockResolvedValue(credentialModel({ vcHash: VC_HASH }));
      verifyRegistration.mockResolvedValue({ verified: false } as never);

      // Act
      const act = register(sut);

      // Assert
      await expect(act).rejects.toBeInstanceOf(ValidationError);
      await expect(act).rejects.toMatchObject({ code: "PASSKEY_VERIFICATION_FAILED" });
      expect(prisma.passkeyCredential.create).not.toHaveBeenCalled();
    });

    it("answers 400 PASSKEY_VERIFICATION_FAILED instead of 500 when the response carries no WebAuthn payload", async () => {
      // Arrange
      const { sut, challengeService, prisma } = makeSut();
      challengeService.consumeContext.mockResolvedValue(registrationContext);

      // Act
      const act = register(sut, { id: "cred-1" } as unknown as RegistrationResponseJSON);

      // Assert
      await expect(act).rejects.toBeInstanceOf(ValidationError);
      await expect(act).rejects.toMatchObject({ code: "PASSKEY_VERIFICATION_FAILED" });
      expect(prisma.passkeyCredential.create).not.toHaveBeenCalled();
    });

    it("answers 400 PASSKEY_CHALLENGE_INVALID when the registration challenge was issued for another issuer", async () => {
      // Arrange
      const { sut, challengeService, prisma } = makeSut();
      challengeService.consumeContext.mockResolvedValue({ ...registrationContext, issuerId: "issuer_other" });

      // Act
      const act = register(sut);

      // Assert
      await expect(act).rejects.toBeInstanceOf(ValidationError);
      await expect(act).rejects.toMatchObject({ code: "PASSKEY_CHALLENGE_INVALID" });
      expect(prisma.passkeyCredential.create).not.toHaveBeenCalled();
    });

    it("answers 404 CREDENTIAL_NOT_FOUND and creates nothing when the issuer-scoped read finds no credential", async () => {
      // Arrange
      const { sut, challengeService, credentialRepository, prisma } = makeSut();
      challengeService.consumeContext.mockResolvedValue(registrationContext);
      credentialRepository.findByVcHashForIssuerOrThrow.mockRejectedValue(
        new NotFoundError("CREDENTIAL_NOT_FOUND", "Credential not found", { vcHash: VC_HASH, issuerId: ISSUER_ID }),
      );
      verifyRegistration.mockResolvedValue({ verified: true, registrationInfo } as never);

      // Act
      const act = register(sut);

      // Assert
      await expect(act).rejects.toBeInstanceOf(NotFoundError);
      await expect(act).rejects.toMatchObject({ code: "CREDENTIAL_NOT_FOUND" });
      expect(prisma.passkeyCredential.create).not.toHaveBeenCalled();
    });
  });

  describe("verifyAuthentication", () => {
    it("issues proof challenge, recovery token and Privy token only after the assertion verifies and the counter advances", async () => {
      // Arrange
      const mocks = makeSut();
      const { sut, challengeService, prisma, walletService } = mocks;
      arrangeAuthentication(mocks);
      verifyAuthentication.mockResolvedValue(verifiedWithCounter(RECORDED_ASSERTION.counter));
      challengeService.generate
        .mockResolvedValueOnce({ challenge: "proof-challenge", expiresAt: 1 })
        .mockResolvedValueOnce({ challenge: "recovery-token", expiresAt: 2 });
      walletService.isEnabledForIssuer.mockResolvedValue(true);
      walletService.issueCustomAuthToken.mockResolvedValue({ token: "signed.jwt.value", expiresAt: 123 });

      // Act
      const result = await authenticate(sut);

      // Assert
      expect(prisma.passkeyCredential.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ counter: RECORDED_ASSERTION.counter - 1 }),
          data: expect.objectContaining({ counter: RECORDED_ASSERTION.counter }),
        }),
      );
      expect(walletService.issueCustomAuthToken).toHaveBeenCalledWith("did:key:subject");
      expect(result).toEqual({
        verified: true,
        vcHash: VC_HASH,
        proofChallenge: "proof-challenge",
        recoveryToken: "recovery-token",
        privyCustomAuthToken: "signed.jwt.value",
        expiresAt: 123,
      });
    });

    it("CT-VESTA-PASS-004 reads the counter the library reads: the recorded assertion verifies for real and persists it", async () => {
      // Arrange
      const mocks = makeSut();
      arrangeAuthentication(mocks);
      verifyAuthentication.mockImplementation(actualWebAuthn.verifyAuthenticationResponse);

      // Act
      const result = await authenticate(mocks.sut);

      // Assert
      expect(result.vcHash).toBe(VC_HASH);
      expect(mocks.prisma.passkeyCredential.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ counter: RECORDED_ASSERTION.counter }) }),
      );
    });

    it.each([
      { stored: RECORDED_ASSERTION.counter, label: "equal to" },
      { stored: RECORDED_ASSERTION.counter + 2, label: "above" },
    ])(
      "CT-VESTA-PASS-004 answers 403 PASSKEY_COUNTER_REGRESSION and writes nothing when the stored counter is $label the assertion's",
      async ({ stored }) => {
        // Arrange
        const mocks = makeSut();
        arrangeAuthentication(mocks, passkeyRecord({ counter: stored }));
        verifyAuthentication.mockImplementation(actualWebAuthn.verifyAuthenticationResponse);

        // Act
        const act = authenticate(mocks.sut);

        // Assert
        await expect(act).rejects.toBeInstanceOf(ForbiddenError);
        await expect(act).rejects.toMatchObject({
          code: "PASSKEY_COUNTER_REGRESSION",
          details: { issuerId: ISSUER_ID, passkeyId: RECORDED_ASSERTION.credentialId },
        });
        expect(mocks.prisma.passkeyCredential.updateMany).not.toHaveBeenCalled();
      },
    );

    it("CT-VESTA-PASS-004 answers 400 PASSKEY_VERIFICATION_FAILED and writes nothing when the library rejects the assertion", async () => {
      // Arrange
      const mocks = makeSut();
      arrangeAuthentication(mocks);
      verifyAuthentication.mockRejectedValue(new Error("Unexpected authentication response origin"));

      // Act
      const act = authenticate(mocks.sut);

      // Assert
      await expect(act).rejects.toBeInstanceOf(ValidationError);
      await expect(act).rejects.toMatchObject({ code: "PASSKEY_VERIFICATION_FAILED" });
      expect(mocks.prisma.passkeyCredential.updateMany).not.toHaveBeenCalled();
    });

    it("CT-VESTA-PASS-004 answers 400 PASSKEY_VERIFICATION_FAILED and writes nothing when the assertion comes back unverified", async () => {
      // Arrange
      const mocks = makeSut();
      arrangeAuthentication(mocks);
      verifyAuthentication.mockResolvedValue({ verified: false } as never);

      // Act
      const act = authenticate(mocks.sut);

      // Assert
      await expect(act).rejects.toBeInstanceOf(ValidationError);
      await expect(act).rejects.toMatchObject({ code: "PASSKEY_VERIFICATION_FAILED" });
      expect(mocks.prisma.passkeyCredential.updateMany).not.toHaveBeenCalled();
    });

    it("CT-VESTA-PASS-007 answers 409 PASSKEY_COUNTER_CONFLICT when the optimistic counter write finds the row already changed", async () => {
      // Arrange
      const mocks = makeSut();
      arrangeAuthentication(mocks);
      verifyAuthentication.mockResolvedValue(verifiedWithCounter(RECORDED_ASSERTION.counter));
      mocks.prisma.passkeyCredential.updateMany.mockResolvedValue({ count: 0 });

      // Act
      const act = authenticate(mocks.sut);

      // Assert
      await expect(act).rejects.toBeInstanceOf(ConflictError);
      await expect(act).rejects.toMatchObject({ code: "PASSKEY_COUNTER_CONFLICT" });
      expect(mocks.challengeService.generate).not.toHaveBeenCalled();
    });

    it("answers 400 PASSKEY_VERIFICATION_FAILED instead of 500 when authenticatorData is too short to carry a counter", async () => {
      // Arrange
      const mocks = makeSut();
      arrangeAuthentication(mocks);
      const response: AuthenticationResponseJSON = {
        ...RECORDED_ASSERTION.response,
        response: {
          ...RECORDED_ASSERTION.response.response,
          authenticatorData: Buffer.alloc(10).toString("base64url"),
        },
      };

      // Act
      const act = authenticate(mocks.sut, response);

      // Assert
      await expect(act).rejects.toBeInstanceOf(ValidationError);
      await expect(act).rejects.toMatchObject({ code: "PASSKEY_VERIFICATION_FAILED" });
      expect(mocks.prisma.passkeyCredential.updateMany).not.toHaveBeenCalled();
    });

    it("answers 400 PASSKEY_VERIFICATION_FAILED instead of 500 when the response has no credential id", async () => {
      // Arrange
      const mocks = makeSut();
      arrangeAuthentication(mocks);
      const response = { ...RECORDED_ASSERTION.response, id: undefined } as unknown as AuthenticationResponseJSON;

      // Act
      const act = authenticate(mocks.sut, response);

      // Assert
      await expect(act).rejects.toBeInstanceOf(ValidationError);
      await expect(act).rejects.toMatchObject({ code: "PASSKEY_VERIFICATION_FAILED" });
      expect(mocks.prisma.passkeyCredential.updateMany).not.toHaveBeenCalled();
    });

    it("answers 400 PASSKEY_CHALLENGE_INVALID when the authentication challenge was issued for another issuer", async () => {
      // Arrange
      const mocks = makeSut();
      arrangeAuthentication(mocks);
      mocks.challengeService.consumeContext.mockResolvedValue({
        kind: "passkey-authentication",
        issuerId: "issuer_other",
        rpId: RP_ID,
      });

      // Act
      const act = authenticate(mocks.sut);

      // Assert
      await expect(act).rejects.toBeInstanceOf(ValidationError);
      await expect(act).rejects.toMatchObject({ code: "PASSKEY_CHALLENGE_INVALID" });
      expect(mocks.prisma.passkeyCredential.updateMany).not.toHaveBeenCalled();
    });

    it("answers 404 PASSKEY_NOT_FOUND when the issuer-scoped read finds no passkey for this issuer and RP ID", async () => {
      // Arrange
      const mocks = makeSut();
      arrangeAuthentication(mocks);
      mocks.prisma.passkeyCredential.findFirst.mockResolvedValue(null);

      // Act
      const act = authenticate(mocks.sut);

      // Assert
      await expect(act).rejects.toBeInstanceOf(NotFoundError);
      await expect(act).rejects.toMatchObject({ code: "PASSKEY_NOT_FOUND" });
      expect(mocks.prisma.passkeyCredential.updateMany).not.toHaveBeenCalled();
    });

    it("answers 400 PASSKEY_VERIFICATION_FAILED instead of 500 when the assertion has no clientDataJSON", async () => {
      // Arrange
      const mocks = makeSut();
      arrangeAuthentication(mocks);
      const response = {
        ...RECORDED_ASSERTION.response,
        response: {
          authenticatorData: RECORDED_ASSERTION.response.response.authenticatorData,
          signature: RECORDED_ASSERTION.response.response.signature,
        },
      } as unknown as AuthenticationResponseJSON;

      // Act
      const act = authenticate(mocks.sut, response);

      // Assert
      await expect(act).rejects.toBeInstanceOf(ValidationError);
      await expect(act).rejects.toMatchObject({ code: "PASSKEY_VERIFICATION_FAILED" });
      expect(mocks.prisma.passkeyCredential.updateMany).not.toHaveBeenCalled();
    });

    it.each([
      { label: "revoked", overrides: { status: CredentialStatus.Revoked } },
      { label: "expired", overrides: { expiresAt: new Date("2000-01-01T00:00:00.000Z") } },
      { label: "still pending", overrides: { status: CredentialStatus.Pending } },
    ])("CT-VESTA-PASS-006 answers 403 CREDENTIAL_NOT_ACTIVE when the credential is $label", async ({ overrides }) => {
      // Arrange
      const mocks = makeSut();
      arrangeAuthentication(mocks);
      mocks.credentialRepository.findByVcHashForIssuerOrThrow.mockResolvedValue(
        credentialModel({ vcHash: VC_HASH, ...overrides }),
      );

      // Act
      const act = authenticate(mocks.sut);

      // Assert
      await expect(act).rejects.toBeInstanceOf(ForbiddenError);
      await expect(act).rejects.toMatchObject({ code: "CREDENTIAL_NOT_ACTIVE" });
      expect(mocks.prisma.passkeyCredential.updateMany).not.toHaveBeenCalled();
    });
  });
});
