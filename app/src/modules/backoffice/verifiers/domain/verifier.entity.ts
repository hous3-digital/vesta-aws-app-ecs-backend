import { BadRequestException } from "@nestjs/common";

export enum VerifierStatus {
  Active = "active",
  Revoked = "revoked",
}

export interface VerifierProps {
  id: string;
  name: string;
  status: VerifierStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class Verifier {
  private readonly _id: string;
  private _name: string;
  private _status: VerifierStatus;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: VerifierProps) {
    this._id = props.id;
    this._name = props.name;
    this._status = props.status;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  public get id(): string { return this._id; }
  public get name(): string { return this._name; }
  public get status(): VerifierStatus { return this._status; }
  public get createdAt(): Date { return this._createdAt; }
  public get updatedAt(): Date { return this._updatedAt; }

  public static create(params: { id: string; name: string }): Verifier {
    if (!params.id.trim()) throw new BadRequestException("Verifier id obrigatorio");
    if (!params.name.trim()) throw new BadRequestException("Verifier name obrigatorio");
    const now = new Date();
    return new Verifier({
      id: params.id,
      name: params.name,
      status: VerifierStatus.Active,
      createdAt: now,
      updatedAt: now,
    });
  }

  public static restore(props: VerifierProps): Verifier {
    return new Verifier(props);
  }

  public rename(name: string): void {
    if (!name.trim()) throw new BadRequestException("Verifier name obrigatorio");
    this._name = name;
    this._updatedAt = new Date();
  }

  public revoke(): void {
    if (this._status === VerifierStatus.Revoked) {
      throw new BadRequestException("Verifier ja esta revogado");
    }
    this._status = VerifierStatus.Revoked;
    this._updatedAt = new Date();
  }

  public reactivate(): void {
    if (this._status === VerifierStatus.Active) {
      throw new BadRequestException("Verifier ja esta ativo");
    }
    this._status = VerifierStatus.Active;
    this._updatedAt = new Date();
  }
}
