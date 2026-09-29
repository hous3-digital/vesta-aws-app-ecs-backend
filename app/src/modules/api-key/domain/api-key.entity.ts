import { ApiKeySecret } from "@src/modules/api-key/domain/api-key-secret.value-object";
import { InvalidStateError, ValidationError } from "@src/shared/errors";
import { Id } from "@src/shared/value-objects/id.value-object";

/** Days the previous key keeps authenticating after a rotation. */
export const ROTATION_GRACE_DAYS = 30;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

export interface ApiKeyProps {
  id: Id;
  issuerId: string | null;
  keyHash: string;
  keyPrefix: string;
  name: string;
  active: boolean;
  createdAt: Date;
  revokedAt: Date | null;
  expiresAt: Date | null;
}

export class ApiKey {
  private readonly _id: Id;
  private readonly _issuerId: string | null;
  private readonly _keyHash: string;
  private readonly _keyPrefix: string;
  private readonly _name: string;
  private _active: boolean;
  private readonly _createdAt: Date;
  private _revokedAt: Date | null;
  private _expiresAt: Date | null;

  private constructor(props: ApiKeyProps) {
    this._id = props.id;
    this._issuerId = props.issuerId;
    this._keyHash = props.keyHash;
    this._keyPrefix = props.keyPrefix;
    this._name = props.name;
    this._active = props.active;
    this._createdAt = props.createdAt;
    this._revokedAt = props.revokedAt;
    this._expiresAt = props.expiresAt;
  }

  public get id(): Id {
    return this._id;
  }
  public get issuerId(): string | null {
    return this._issuerId;
  }
  public get keyHash(): string {
    return this._keyHash;
  }
  public get keyPrefix(): string {
    return this._keyPrefix;
  }
  public get name(): string {
    return this._name;
  }
  public get active(): boolean {
    return this._active;
  }
  public get createdAt(): Date {
    return this._createdAt;
  }
  public get revokedAt(): Date | null {
    return this._revokedAt;
  }
  public get expiresAt(): Date | null {
    return this._expiresAt;
  }

  /**
   * Creates an active key for an issuer. The secret is returned next to the
   * entity because this is the only moment it exists in clear: the entity
   * keeps its hash and its prefix and nothing else.
   */
  public static create(params: { name: string; issuerId: string }): { apiKey: ApiKey; secret: ApiKeySecret } {
    const name = params.name.trim();
    if (name.length === 0) {
      throw new ValidationError("API_KEY_NAME_REQUIRED", "API key name is required");
    }

    const secret = ApiKeySecret.generate();
    const apiKey = new ApiKey({
      id: Id.create("ak"),
      issuerId: params.issuerId,
      keyHash: secret.hash,
      keyPrefix: secret.prefix,
      name,
      active: true,
      createdAt: new Date(),
      revokedAt: null,
      expiresAt: null,
    });

    return { apiKey, secret };
  }

  public static restore(props: ApiKeyProps): ApiKey {
    return new ApiKey(props);
  }

  /**
   * Replaces this key by a new one for the same issuer and name. This key keeps
   * authenticating for ROTATION_GRACE_DAYS so the issuer can switch without
   * downtime; a key already in its grace period cannot be rotated again, or the
   * old secret would never expire.
   */
  public rotate(now: Date): { next: ApiKey; secret: ApiKeySecret; issuerId: string; expiresAt: Date } {
    this.ensureUsable(now);
    if (this._expiresAt !== null) {
      throw new InvalidStateError("API_KEY_ALREADY_ROTATED", "API key is already in its rotation grace period", {
        apiKeyId: this._id.value,
      });
    }

    const issuerId = this.requireIssuerId();
    const { apiKey: next, secret } = ApiKey.create({ name: this._name, issuerId });
    const expiresAt = new Date(now.getTime() + ROTATION_GRACE_DAYS * DAY_IN_MS);
    this._expiresAt = expiresAt;
    return { next, secret, issuerId, expiresAt };
  }

  public revoke(now: Date): void {
    if (!this._active) {
      throw new InvalidStateError("API_KEY_ALREADY_REVOKED", "API key is already revoked", {
        apiKeyId: this._id.value,
      });
    }
    this._active = false;
    this._revokedAt = now;
  }

  public isExpired(now: Date): boolean {
    return this._expiresAt !== null && now.getTime() >= this._expiresAt.getTime();
  }

  public isUsable(now: Date): boolean {
    return this._active && this._issuerId !== null && !this.isExpired(now);
  }

  public ensureUsable(now: Date): void {
    if (!this._active) {
      throw new InvalidStateError("API_KEY_REVOKED", "API key is revoked", { apiKeyId: this._id.value });
    }
    this.requireIssuerId();
    if (this.isExpired(now)) {
      throw new InvalidStateError("API_KEY_EXPIRED", "API key expired after rotation; generate a new key", {
        apiKeyId: this._id.value,
      });
    }
  }

  private requireIssuerId(): string {
    if (this._issuerId === null) {
      throw new InvalidStateError("API_KEY_WITHOUT_ISSUER", "API key is not linked to an issuer", {
        apiKeyId: this._id.value,
      });
    }
    return this._issuerId;
  }
}
