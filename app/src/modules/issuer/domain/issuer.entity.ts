export interface IssuerProps {
  id: string;
  externalId: string;
  name: string;
  status: string;
  publicKey: string | null;
  privyEnabled: boolean;
  createdAt: Date;
}

export class Issuer {
  private readonly _id: string;
  private readonly _externalId: string;
  private readonly _name: string;
  private readonly _status: string;
  private readonly _publicKey: string | null;
  private readonly _privyEnabled: boolean;
  private readonly _createdAt: Date;

  private constructor(props: IssuerProps) {
    this._id = props.id;
    this._externalId = props.externalId;
    this._name = props.name;
    this._status = props.status;
    this._publicKey = props.publicKey;
    this._privyEnabled = props.privyEnabled;
    this._createdAt = props.createdAt;
  }

  public get id(): string {
    return this._id;
  }
  public get externalId(): string {
    return this._externalId;
  }
  public get name(): string {
    return this._name;
  }
  public get status(): string {
    return this._status;
  }
  public get publicKey(): string | null {
    return this._publicKey;
  }
  public get privyEnabled(): boolean {
    return this._privyEnabled;
  }
  public get createdAt(): Date {
    return this._createdAt;
  }

  public isActive(): boolean {
    return this._status === "active";
  }

  public static restore(props: IssuerProps): Issuer {
    return new Issuer(props);
  }
}
