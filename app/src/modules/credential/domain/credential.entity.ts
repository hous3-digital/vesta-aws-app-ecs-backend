import { BadRequestException } from "@nestjs/common";
import { Id } from "@src/shared/value-objects/id.value-object";
import type { KycLevel } from "@src/shared/types/vesta-vc.types";

export enum CredentialStatus {
  Active = "ACTIVE",
  Revoked = "REVOKED",
  Expired = "EXPIRED",
  Pending = "PENDING",
  Rejected = "REJECTED",
}

export interface CredentialProps {
  id: Id;
  vcHash: string;
  cpfDedupKey: string | null;
  issuerDid: string;
  issuerId: string;
  subjectDid: string;
  kycLevel: string;
  status: CredentialStatus;
  sorobanTxHash: string | null;
  userWalletAddress: string | null;
  privyUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export class Credential {
  private readonly _id: Id;
  private readonly _vcHash: string;
  private readonly _cpfDedupKey: string | null;
  private readonly _issuerDid: string;
  private readonly _issuerId: string;
  private readonly _subjectDid: string;
  private _kycLevel: string;
  private _status: CredentialStatus;
  private _sorobanTxHash: string | null;
  private _userWalletAddress: string | null;
  private _privyUserId: string | null;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private readonly _expiresAt: Date;

  private constructor(props: CredentialProps) {
    this._id = props.id;
    this._vcHash = props.vcHash;
    this._cpfDedupKey = props.cpfDedupKey;
    this._issuerDid = props.issuerDid;
    this._issuerId = props.issuerId;
    this._subjectDid = props.subjectDid;
    this._kycLevel = props.kycLevel;
    this._status = props.status;
    this._sorobanTxHash = props.sorobanTxHash;
    this._userWalletAddress = props.userWalletAddress;
    this._privyUserId = props.privyUserId;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
    this._expiresAt = props.expiresAt;
  }

  public get id(): Id { return this._id; }
  public get vcHash(): string { return this._vcHash; }
  public get cpfDedupKey(): string | null { return this._cpfDedupKey; }
  public get issuerDid(): string { return this._issuerDid; }
  public get issuerId(): string { return this._issuerId; }
  public get subjectDid(): string { return this._subjectDid; }
  public get kycLevel(): string { return this._kycLevel; }
  public get status(): CredentialStatus { return this._status; }
  public get sorobanTxHash(): string | null { return this._sorobanTxHash; }
  public get userWalletAddress(): string | null { return this._userWalletAddress; }
  public get privyUserId(): string | null { return this._privyUserId; }
  public get createdAt(): Date { return this._createdAt; }
  public get updatedAt(): Date { return this._updatedAt; }
  public get expiresAt(): Date { return this._expiresAt; }

  public static issue(params: {
    vcHash: string;
    cpfDedupKey: string | null;
    issuerDid: string;
    issuerId: string;
    subjectDid: string;
    kycLevel: KycLevel;
    expiresAt: Date;
  }): Credential {
    const id = Id.create("credential");
    const now = new Date();

    return new Credential({
      id,
      vcHash: params.vcHash,
      cpfDedupKey: params.cpfDedupKey,
      issuerDid: params.issuerDid,
      issuerId: params.issuerId,
      subjectDid: params.subjectDid,
      kycLevel: params.kycLevel,
      status: CredentialStatus.Active,
      sorobanTxHash: null,
      userWalletAddress: null,
      privyUserId: null,
      createdAt: now,
      updatedAt: now,
      expiresAt: params.expiresAt,
    });
  }

  /**
   * Emite uma credencial no estado PENDING — usada quando o KYC do issuer é
   * assíncrono e ainda não temos o veredito. O status vira ACTIVE via `approve`
   * ou REJECTED via `reject` quando o webhook do KYC provider chegar.
   */
  public static issuePending(params: {
    vcHash: string;
    cpfDedupKey: string | null;
    issuerDid: string;
    issuerId: string;
    subjectDid: string;
    kycLevel: KycLevel;
    expiresAt: Date;
  }): Credential {
    const credential = Credential.issue(params);
    credential._status = CredentialStatus.Pending;
    return credential;
  }

  public static restore(props: CredentialProps): Credential {
    return new Credential(props);
  }

  public revoke(): void {
    if (this._status === CredentialStatus.Revoked) {
      throw new BadRequestException("Credencial já está revogada");
    }
    this._status = CredentialStatus.Revoked;
    this._updatedAt = new Date();
  }

  public approve(kycLevel: KycLevel): void {
    if (this._status !== CredentialStatus.Pending) {
      throw new BadRequestException(
        `Só é possível aprovar credencial pendente. Status atual: ${this._status}`,
      );
    }
    this._status = CredentialStatus.Active;
    this._kycLevel = kycLevel;
    this._updatedAt = new Date();
  }

  public reject(): void {
    if (this._status !== CredentialStatus.Pending) {
      throw new BadRequestException(
        `Só é possível reprovar credencial pendente. Status atual: ${this._status}`,
      );
    }
    this._status = CredentialStatus.Rejected;
    this._updatedAt = new Date();
  }

  /**
   * Associa a wallet Privy criada para o usuário a esta credencial.
   * Chamado pelo handler de emissão (eager) ou pelo handler de prepare (lazy retroativo).
   */
  public attachWallet(params: { userWalletAddress: string; privyUserId: string }): void {
    this._userWalletAddress = params.userWalletAddress;
    this._privyUserId = params.privyUserId;
    this._updatedAt = new Date();
  }

  public isExpired(): boolean {
    return new Date() > this._expiresAt;
  }

  public isRevoked(): boolean {
    return this._status === CredentialStatus.Revoked;
  }

  public isApproved(): boolean {
    return this._status === CredentialStatus.Active;
  }

  public isPending(): boolean {
    return this._status === CredentialStatus.Pending;
  }

  public isRejected(): boolean {
    return this._status === CredentialStatus.Rejected;
  }
}
