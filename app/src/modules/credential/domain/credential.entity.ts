import { BadRequestException } from "@nestjs/common";
import { Id } from "@src/shared/value-objects/id.value-object";
import type { KycLevel } from "@src/shared/types/vesta-vc.types";

export enum CredentialStatus {
  Active = "ACTIVE",
  Revoked = "REVOKED",
  Expired = "EXPIRED",
}

export interface CredentialProps {
  id: Id;
  vcHash: string;
  issuerDid: string;
  issuerId: string;
  subjectDid: string;
  kycLevel: string;
  status: CredentialStatus;
  sorobanTxHash: string | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export class Credential {
  private readonly _id: Id;
  private readonly _vcHash: string;
  private readonly _issuerDid: string;
  private readonly _issuerId: string;
  private readonly _subjectDid: string;
  private readonly _kycLevel: string;
  private _status: CredentialStatus;
  private _sorobanTxHash: string | null;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private readonly _expiresAt: Date;

  private constructor(props: CredentialProps) {
    this._id = props.id;
    this._vcHash = props.vcHash;
    this._issuerDid = props.issuerDid;
    this._issuerId = props.issuerId;
    this._subjectDid = props.subjectDid;
    this._kycLevel = props.kycLevel;
    this._status = props.status;
    this._sorobanTxHash = props.sorobanTxHash;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
    this._expiresAt = props.expiresAt;
  }

  public get id(): Id { return this._id; }
  public get vcHash(): string { return this._vcHash; }
  public get issuerDid(): string { return this._issuerDid; }
  public get issuerId(): string { return this._issuerId; }
  public get subjectDid(): string { return this._subjectDid; }
  public get kycLevel(): string { return this._kycLevel; }
  public get status(): CredentialStatus { return this._status; }
  public get sorobanTxHash(): string | null { return this._sorobanTxHash; }
  public get createdAt(): Date { return this._createdAt; }
  public get updatedAt(): Date { return this._updatedAt; }
  public get expiresAt(): Date { return this._expiresAt; }

  public static issue(params: {
    vcHash: string;
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
      issuerDid: params.issuerDid,
      issuerId: params.issuerId,
      subjectDid: params.subjectDid,
      kycLevel: params.kycLevel,
      status: CredentialStatus.Active,
      sorobanTxHash: null,
      createdAt: now,
      updatedAt: now,
      expiresAt: params.expiresAt,
    });
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

  public isExpired(): boolean {
    return new Date() > this._expiresAt;
  }

  public isRevoked(): boolean {
    return this._status === CredentialStatus.Revoked;
  }

  public isApproved(): boolean {
    return this._status === CredentialStatus.Active;
  }
}
