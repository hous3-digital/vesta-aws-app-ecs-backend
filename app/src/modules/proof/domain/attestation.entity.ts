import { Id } from "@src/shared/value-objects/id.value-object";

export interface AttestationProps {
  id: Id;
  vcHash: string;
  proofHash: string;
  verifierId: string;
  kycLevel: string;
  sorobanTxHash: string | null;
  sorobanLedger: number | null;
  onChainResult: boolean;
  createdAt: Date;
}

export class Attestation {
  private readonly _id: Id;
  private readonly _vcHash: string;
  private readonly _proofHash: string;
  private readonly _verifierId: string;
  private readonly _kycLevel: string;
  private readonly _sorobanTxHash: string | null;
  private readonly _sorobanLedger: number | null;
  private readonly _onChainResult: boolean;
  private readonly _createdAt: Date;

  private constructor(props: AttestationProps) {
    this._id = props.id;
    this._vcHash = props.vcHash;
    this._proofHash = props.proofHash;
    this._verifierId = props.verifierId;
    this._kycLevel = props.kycLevel;
    this._sorobanTxHash = props.sorobanTxHash;
    this._sorobanLedger = props.sorobanLedger;
    this._onChainResult = props.onChainResult;
    this._createdAt = props.createdAt;
  }

  public get id(): Id { return this._id; }
  public get vcHash(): string { return this._vcHash; }
  public get proofHash(): string { return this._proofHash; }
  public get verifierId(): string { return this._verifierId; }
  public get kycLevel(): string { return this._kycLevel; }
  public get sorobanTxHash(): string | null { return this._sorobanTxHash; }
  public get sorobanLedger(): number | null { return this._sorobanLedger; }
  public get onChainResult(): boolean { return this._onChainResult; }
  public get createdAt(): Date { return this._createdAt; }

  public static create(params: {
    vcHash: string;
    proofHash: string;
    verifierId: string;
    kycLevel: string;
    sorobanTxHash: string | null;
    sorobanLedger: number | null;
    onChainResult: boolean;
  }): Attestation {
    return new Attestation({
      id: Id.create("attestation"),
      ...params,
      createdAt: new Date(),
    });
  }

  public static restore(props: AttestationProps): Attestation {
    return new Attestation(props);
  }
}
