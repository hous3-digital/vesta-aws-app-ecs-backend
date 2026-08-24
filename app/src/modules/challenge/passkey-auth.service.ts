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
} from "@simplewebauthn/server";
import { PrismaService } from "@src/infra/database/@prisma/prisma.service";
import { EnvService } from "@src/infra/env/env.service";
import { ChallengeService } from "@src/modules/challenge/challenge.service";
import { ICredentialRepository } from "@src/modules/credential/domain/credential.repository";
import { WalletService } from "@src/modules/wallet/wallet.service";
import { createHash } from "crypto";

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
    const stored = await this.challengeService.generate({
      kind: "passkey-registration",
      issuerId,
      rpId,
      vcHash,
    });
    return generateRegistrationOptions({
      rpName: "Vesta Digital Passport",
      rpID: rpId,
      userName: "Vesta credential holder",
      userDisplayName: "Vesta KYC Credential",
      userID: createHash("sha256").update(credential.subjectDid).digest(),
      challenge: stored.challenge,
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
  }

  public async verifyRegistration(params: {
    issuerId: string;
    challenge: string;
    response: RegistrationResponseJSON;
  }): Promise<{ verified: true; passkeyCredentialId: string; vcHash: string }> {
    const context = await this.challengeService.consumeContext(params.challenge);
    if (!context || context.kind !== "passkey-registration" || context.issuerId !== params.issuerId) {
      throw new BadRequestException("Challenge de registro inválido, expirado ou já utilizado");
    }

    const verification = await verifyRegistrationResponse({
      response: params.response,
      expectedChallenge: params.challenge,
      expectedOrigin: this.assertAllowedOrigin(params.response.response.clientDataJSON),
      expectedRPID: context.rpId,
      requireUserVerification: true,
    });
    if (!verification.verified) throw new BadRequestException("Registro do Passkey não pôde ser verificado");

    const credential = await this.credentialRepository.findByVcHash(context.vcHash);
    if (!credential || credential.issuerId !== params.issuerId) {
      throw new ForbiddenException("Credencial inválida para o issuer autenticado");
    }

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
    const stored = await this.challengeService.generate({
      kind: "passkey-authentication",
      issuerId,
      rpId,
    });
    return generateAuthenticationOptions({
      rpID: rpId,
      challenge: stored.challenge,
      timeout: 60_000,
      userVerification: "required",
    });
  }

  public async verifyAuthentication(params: {
    issuerId: string;
    challenge: string;
    response: AuthenticationResponseJSON;
  }): Promise<{
    verified: true;
    vcHash: string;
    proofChallenge: string;
    privyCustomAuthToken: string | null;
    expiresAt: number | null;
  }> {
    const context = await this.challengeService.consumeContext(params.challenge);
    if (!context || context.kind !== "passkey-authentication" || context.issuerId !== params.issuerId) {
      throw new BadRequestException("Challenge de autenticação inválido, expirado ou já utilizado");
    }

    const passkey = await this.prisma.passkeyCredential.findUnique({ where: { id: params.response.id } });
    if (!passkey || passkey.issuerId !== params.issuerId || passkey.rpId !== context.rpId) {
      throw new ForbiddenException("Passkey não registrado para este issuer e RP ID");
    }
    const credential = await this.credentialRepository.findByVcHash(passkey.vcHash);
    if (!credential || !credential.isApproved() || credential.isExpired() || credential.isRevoked()) {
      throw new ForbiddenException("Credencial revogada, expirada ou não aprovada");
    }

    const verification = await verifyAuthenticationResponse({
      response: params.response,
      expectedChallenge: params.challenge,
      expectedOrigin: this.assertAllowedOrigin(params.response.response.clientDataJSON),
      expectedRPID: context.rpId,
      credential: {
        id: passkey.id,
        publicKey: Buffer.from(passkey.publicKey, "base64url"),
        counter: passkey.counter,
        transports: this.toTransports(passkey.transports),
      },
      requireUserVerification: true,
    });
    if (!verification.verified) throw new BadRequestException("Assertion do Passkey não pôde ser verificada");

    const counterUpdated = await this.prisma.passkeyCredential.updateMany({
      where: { id: passkey.id, counter: passkey.counter },
      data: {
        counter: verification.authenticationInfo.newCounter,
        backedUp: verification.authenticationInfo.credentialBackedUp,
        deviceType: verification.authenticationInfo.credentialDeviceType,
        updatedAt: new Date(),
      },
    });
    if (counterUpdated.count !== 1) {
      throw new ConflictException("O contador da Passkey mudou durante a autenticação; tente novamente");
    }

    const proof = await this.challengeService.generate({
      kind: "proof",
      issuerId: params.issuerId,
      vcHash: passkey.vcHash,
    });
    const privyEnabled = await this.walletService.isEnabledForIssuer(params.issuerId);
    const customAuth = privyEnabled
      ? await this.walletService.issueCustomAuthToken(passkey.subjectDid)
      : null;

    return {
      verified: true,
      vcHash: passkey.vcHash,
      proofChallenge: proof.challenge,
      privyCustomAuthToken: customAuth?.token ?? null,
      expiresAt: customAuth?.expiresAt ?? null,
    };
  }

  private allowedOrigins(): string[] {
    return this.envService.WEBAUTHN_ALLOWED_ORIGINS.split(",").map((value) => value.trim()).filter(Boolean);
  }

  private assertAllowedRpId(rpId: string): void {
    const allowed = this.envService.WEBAUTHN_ALLOWED_RP_IDS.split(",").map((value) => value.trim()).filter(Boolean);
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
    return value.filter((item): item is "ble" | "cable" | "hybrid" | "internal" | "nfc" | "smart-card" | "usb" =>
      typeof item === "string" && ["ble", "cable", "hybrid", "internal", "nfc", "smart-card", "usb"].includes(item),
    );
  }
}
