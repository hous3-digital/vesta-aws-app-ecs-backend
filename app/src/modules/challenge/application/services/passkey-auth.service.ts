import { createHash } from "crypto";

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
  VerifiedAuthenticationResponse,
  VerifiedRegistrationResponse,
} from "@simplewebauthn/server";

import { PrismaService } from "@src/infra/database/@prisma/prisma.service";
import { EnvService } from "@src/infra/env/env.service";
import { ChallengeService } from "@src/modules/challenge/application/services/challenge.service";
import { Passkey } from "@src/modules/challenge/domain/passkey.entity";
import { ICredentialRepository } from "@src/modules/credential/domain/credential.repository";
import { WalletService } from "@src/modules/wallet/application/services/wallet.service";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@src/shared/errors";

// O browser recebe timeout de 60s. O servidor mantém uma margem adicional
// para que latência de rede/serialização após a biometria não invalide uma
// ceremony que o autenticador concluiu dentro do prazo.
const WEBAUTHN_SERVER_CHALLENGE_TTL_SECONDS = 120;
// WebAuthn L2 6.1: authenticatorData starts with rpIdHash (32 bytes) and flags (1 byte),
// followed by the 4-byte big-endian signature counter.
const SIGN_COUNT_OFFSET = 33;
const SIGN_COUNT_LENGTH = 4;

@Injectable()
export class PasskeyAuthService {
  public constructor(
    private readonly challengeService: ChallengeService,
    private readonly credentialRepository: ICredentialRepository,
    private readonly envService: EnvService,
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
  ) {}

  public async registrationOptions(issuerId: string, vcHash: string, rpId: string) {
    this.assertAllowedRpId(rpId);
    const credential = await this.credentialRepository.findByVcHash(vcHash);
    if (!credential) throw new NotFoundException("Credencial não encontrada");
    if (credential.issuerId !== issuerId) throw new ForbiddenException("Credencial pertence a outro issuer");
    if (!credential.isApproved() || credential.isExpired() || credential.isRevoked()) {
      throw new ForbiddenException("Credencial revogada, expirada ou não aprovada");
    }

    const existing = await this.prisma.passkeyCredential.findUnique({ where: { vcHash } });
    if (existing) {
      throw new ConflictException(
        "Esta credencial já possui um Passkey registrado; recuperação exige um fluxo autenticado separado",
      );
    }
    const options = await generateRegistrationOptions({
      rpName: "Vesta Digital Passport",
      rpID: rpId,
      userName: "Vesta credential holder",
      userDisplayName: "Vesta KYC Credential",
      userID: createHash("sha256").update(credential.subjectDid).digest(),
      timeout: 60_000,
      attestationType: "none",
      excludeCredentials: [],
      authenticatorSelection: {
        residentKey: "required",
        requireResidentKey: true,
        userVerification: "required",
      },
      supportedAlgorithmIDs: [-7, -257],
    });
    await this.challengeService.store(
      options.challenge,
      {
        kind: "passkey-registration",
        issuerId,
        rpId,
        vcHash,
      },
      WEBAUTHN_SERVER_CHALLENGE_TTL_SECONDS,
    );
    return options;
  }

  public async verifyRegistration(params: {
    issuerId: string;
    challenge: string;
    response: RegistrationResponseJSON;
  }): Promise<{ verified: true; passkeyCredentialId: string; vcHash: string }> {
    const context = await this.challengeService.consumeContext(params.challenge);
    if (!context || context.kind !== "passkey-registration" || context.issuerId !== params.issuerId) {
      throw new ValidationError(
        "PASSKEY_CHALLENGE_INVALID",
        "Registration challenge is invalid, expired or already used",
        { issuerId: params.issuerId },
      );
    }
    const expectedOrigin = this.assertAllowedOrigin(this.clientDataOf(params.response, params.issuerId));

    let verification: VerifiedRegistrationResponse;
    try {
      verification = await verifyRegistrationResponse({
        response: params.response,
        expectedChallenge: params.challenge,
        expectedOrigin,
        expectedRPID: context.rpId,
        requireUserVerification: true,
      });
    } catch {
      throw this.verificationFailed("registration", { issuerId: params.issuerId });
    }
    if (!verification.verified) throw this.verificationFailed("registration", { issuerId: params.issuerId });

    const credential = await this.credentialRepository.findByVcHashForIssuerOrThrow(context.vcHash, params.issuerId);

    const info = verification.registrationInfo;
    await this.prisma.passkeyCredential.create({
      data: {
        id: info.credential.id,
        vcHash: context.vcHash,
        issuerId: params.issuerId,
        subjectDid: credential.subjectDid,
        publicKey: Buffer.from(info.credential.publicKey).toString("base64url"),
        counter: info.credential.counter,
        transports: info.credential.transports ?? [],
        deviceType: info.credentialDeviceType,
        backedUp: info.credentialBackedUp,
        rpId: context.rpId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return { verified: true, passkeyCredentialId: info.credential.id, vcHash: context.vcHash };
  }

  public async authenticationOptions(issuerId: string, rpId: string) {
    this.assertAllowedRpId(rpId);
    const options = await generateAuthenticationOptions({
      rpID: rpId,
      timeout: 60_000,
      userVerification: "required",
    });
    await this.challengeService.store(
      options.challenge,
      {
        kind: "passkey-authentication",
        issuerId,
        rpId,
      },
      WEBAUTHN_SERVER_CHALLENGE_TTL_SECONDS,
    );
    return options;
  }

  public async verifyAuthentication(params: {
    issuerId: string;
    challenge: string;
    response: AuthenticationResponseJSON;
  }): Promise<{
    verified: true;
    vcHash: string;
    proofChallenge: string;
    recoveryToken: string;
    privyCustomAuthToken: string | null;
    expiresAt: number | null;
  }> {
    const context = await this.challengeService.consumeContext(params.challenge);
    if (!context || context.kind !== "passkey-authentication" || context.issuerId !== params.issuerId) {
      throw new ValidationError(
        "PASSKEY_CHALLENGE_INVALID",
        "Authentication challenge is invalid, expired or already used",
        { issuerId: params.issuerId },
      );
    }
    const assertion = this.readAssertion(params.response, params.issuerId);

    // Scoped by the issuer and the RP ID in the query: another issuer's passkey is
    // indistinguishable from a missing one.
    const record = await this.prisma.passkeyCredential.findFirst({
      where: { id: assertion.credentialId, issuerId: params.issuerId, rpId: context.rpId },
    });
    if (!record) {
      throw new NotFoundError("PASSKEY_NOT_FOUND", "Passkey not found", {
        issuerId: params.issuerId,
        passkeyId: assertion.credentialId,
      });
    }
    const credential = await this.credentialRepository.findByVcHashForIssuerOrThrow(record.vcHash, params.issuerId);
    if (!credential.isApproved() || credential.isExpired() || credential.isRevoked()) {
      throw new ForbiddenError("CREDENTIAL_NOT_ACTIVE", "Credential is revoked, expired or not approved", {
        issuerId: params.issuerId,
        vcHash: record.vcHash,
      });
    }
    const expectedOrigin = this.assertAllowedOrigin(this.clientDataOf(params.response, params.issuerId));

    // The entity applies the counter rule before the verifier runs, so a cloned authenticator
    // answers a stable code; the verifier's own counter check stays on and is never reached.
    const passkey = Passkey.restore({
      id: record.id,
      issuerId: record.issuerId,
      vcHash: record.vcHash,
      rpId: record.rpId,
      counter: record.counter,
    });
    const storedCounter = passkey.counter;
    passkey.authenticate(assertion.signCount);

    let verification: VerifiedAuthenticationResponse;
    try {
      verification = await verifyAuthenticationResponse({
        response: params.response,
        expectedChallenge: params.challenge,
        expectedOrigin,
        expectedRPID: context.rpId,
        credential: {
          id: passkey.id,
          publicKey: Buffer.from(record.publicKey, "base64url"),
          counter: storedCounter,
          transports: this.toTransports(record.transports),
        },
        requireUserVerification: true,
      });
    } catch {
      throw this.verificationFailed("authentication", { issuerId: params.issuerId, passkeyId: passkey.id });
    }
    if (!verification.verified) {
      throw this.verificationFailed("authentication", { issuerId: params.issuerId, passkeyId: passkey.id });
    }

    const counterUpdated = await this.prisma.passkeyCredential.updateMany({
      where: { id: passkey.id, counter: storedCounter },
      data: {
        counter: passkey.counter,
        backedUp: verification.authenticationInfo.credentialBackedUp,
        deviceType: verification.authenticationInfo.credentialDeviceType,
        updatedAt: new Date(),
      },
    });
    if (counterUpdated.count !== 1) {
      throw new ConflictError("PASSKEY_COUNTER_CONFLICT", "Passkey counter changed during authentication; try again", {
        issuerId: params.issuerId,
        passkeyId: passkey.id,
      });
    }

    const proof = await this.challengeService.generate({
      kind: "proof",
      issuerId: params.issuerId,
      vcHash: passkey.vcHash,
    });
    const recovery = await this.challengeService.generate({
      kind: "credential-recovery",
      issuerId: params.issuerId,
      rpId: context.rpId,
      vcHash: passkey.vcHash,
    });
    const privyEnabled = await this.walletService.isEnabledForIssuer(params.issuerId);
    const customAuth = privyEnabled ? await this.walletService.issueCustomAuthToken(record.subjectDid) : null;

    return {
      verified: true,
      vcHash: passkey.vcHash,
      proofChallenge: proof.challenge,
      recoveryToken: recovery.challenge,
      privyCustomAuthToken: customAuth?.token ?? null,
      expiresAt: customAuth?.expiresAt ?? null,
    };
  }

  /**
   * The controller forwards the DTO's `response` object as is, so the fields the service
   * reads before the verifier runs are checked here: a malformed body answers 400, never
   * 500. The signature counter is the big-endian integer at SIGN_COUNT_OFFSET of
   * authenticatorData, the same bytes the verifier reads.
   */
  private readAssertion(
    response: AuthenticationResponseJSON,
    issuerId: string,
  ): { credentialId: string; signCount: number } {
    const authenticatorData: unknown = response.response?.authenticatorData;
    const authData = typeof authenticatorData === "string" ? Buffer.from(authenticatorData, "base64url") : null;
    if (typeof response.id !== "string" || response.id.length === 0 || !authData) {
      throw new ValidationError("PASSKEY_VERIFICATION_FAILED", "Passkey assertion is malformed", { issuerId });
    }
    if (authData.byteLength < SIGN_COUNT_OFFSET + SIGN_COUNT_LENGTH) {
      throw new ValidationError("PASSKEY_VERIFICATION_FAILED", "Passkey assertion is malformed", { issuerId });
    }
    return { credentialId: response.id, signCount: authData.readUInt32BE(SIGN_COUNT_OFFSET) };
  }

  private clientDataOf(response: RegistrationResponseJSON | AuthenticationResponseJSON, issuerId: string): string {
    const clientDataJSON: unknown = response.response?.clientDataJSON;
    if (typeof clientDataJSON !== "string") {
      throw new ValidationError("PASSKEY_VERIFICATION_FAILED", "Passkey response is malformed", { issuerId });
    }
    return clientDataJSON;
  }

  /** The verifier's reason is dropped on purpose: its messages quote the challenge and the origin. */
  private verificationFailed(
    stage: "registration" | "authentication",
    details: Record<string, unknown>,
  ): ValidationError {
    return new ValidationError("PASSKEY_VERIFICATION_FAILED", `Passkey ${stage} could not be verified`, details);
  }

  private allowedOrigins(): string[] {
    return this.envService.WEBAUTHN_ALLOWED_ORIGINS.split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }

  private assertAllowedRpId(rpId: string): void {
    const allowed = this.envService.WEBAUTHN_ALLOWED_RP_IDS.split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const matches = allowed.some((pattern) =>
      pattern.startsWith("*.") ? rpId.endsWith(pattern.slice(1)) && rpId !== pattern.slice(2) : rpId === pattern,
    );
    if (!matches) throw new ForbiddenException("RP ID não autorizado para WebAuthn");
  }

  private assertAllowedOrigin(clientDataJSON: string): string {
    let origin: string;
    try {
      const clientData = JSON.parse(Buffer.from(clientDataJSON, "base64url").toString("utf8")) as {
        origin?: unknown;
      };
      if (typeof clientData.origin !== "string") throw new Error("origin ausente");
      origin = clientData.origin;
    } catch {
      throw new BadRequestException("clientDataJSON WebAuthn inválido");
    }

    let candidate: URL;
    try {
      candidate = new URL(origin);
    } catch {
      throw new BadRequestException("Origin WebAuthn inválido");
    }
    const matches = this.allowedOrigins().some((pattern) => {
      if (!pattern.includes("*")) return origin === pattern;
      const wildcard = pattern.match(/^(https?):\/\/\*\.([^/:]+)(?::(\d+))?$/);
      if (!wildcard) return false;
      const [, protocol, suffix, port] = wildcard;
      return (
        candidate.protocol === `${protocol}:` &&
        candidate.hostname.endsWith(`.${suffix}`) &&
        candidate.hostname !== suffix &&
        (port ? candidate.port === port : !candidate.port)
      );
    });
    if (!matches) throw new ForbiddenException("Origin não autorizado para WebAuthn");
    return origin;
  }

  private toTransports(value: unknown) {
    if (!Array.isArray(value)) return undefined;
    return value.filter(
      (item): item is "ble" | "cable" | "hybrid" | "internal" | "nfc" | "smart-card" | "usb" =>
        typeof item === "string" && ["ble", "cable", "hybrid", "internal", "nfc", "smart-card", "usb"].includes(item),
    );
  }
}
