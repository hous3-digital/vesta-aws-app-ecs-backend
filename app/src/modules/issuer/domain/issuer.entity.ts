import { IssuerDid } from "@src/modules/issuer/domain/issuer-did.value-object";

export type IssuerRole = "TECHNICAL" | "COMMERCIAL";
export type IssuerRegistryStatus = "UNREGISTERED" | "REGISTERED" | "SUSPENDED";

export interface IssuerProps {
  id: string;
  externalId: string;
  name: string;
  status: string;
  publicKey: string | null;
  privyEnabled: boolean;
  did: IssuerDid | null;
  roles: readonly IssuerRole[];
  authorizedCredentialTypes: readonly string[];
  registryStatus: IssuerRegistryStatus;
  createdAt: Date;
}

export class Issuer {
  private readonly _id: string;
  private readonly _externalId: string;
  private readonly _name: string;
  private readonly _status: string;
  private readonly _publicKey: string | null;
  private readonly _privyEnabled: boolean;
  private readonly _did: IssuerDid | null;
  private readonly _roles: readonly IssuerRole[];
  private readonly _authorizedCredentialTypes: readonly string[];
  private readonly _registryStatus: IssuerRegistryStatus;
  private readonly _createdAt: Date;

  private constructor(props: IssuerProps) {
    this._id = props.id;
    this._externalId = props.externalId;
    this._name = props.name;
    this._status = props.status;
    this._publicKey = props.publicKey;
    this._privyEnabled = props.privyEnabled;
    this._did = props.did;
    this._roles = [...new Set(props.roles)];
    this._authorizedCredentialTypes = [...new Set(props.authorizedCredentialTypes)];
    this._registryStatus = props.registryStatus;
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
  public get did(): IssuerDid | null {
    return this._did;
  }
  public get roles(): readonly IssuerRole[] {
    return this._roles;
  }
  public get authorizedCredentialTypes(): readonly string[] {
    return this._authorizedCredentialTypes;
  }
  public get registryStatus(): IssuerRegistryStatus {
    return this._registryStatus;
  }
  public get createdAt(): Date {
    return this._createdAt;
  }

  public isActive(): boolean {
    return this._status === "active";
  }

  public hasRole(role: IssuerRole): boolean {
    return this._roles.includes(role);
  }

  public canIssueCredentialType(type: string): boolean {
    return this._authorizedCredentialTypes.includes(type);
  }

  public isRegistryReady(): boolean {
    return this._registryStatus === "REGISTERED" && this._did !== null && this._roles.length > 0;
  }

  public static restore(props: IssuerProps): Issuer {
    return new Issuer(props);
  }
}
