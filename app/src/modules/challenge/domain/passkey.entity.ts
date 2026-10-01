import { ForbiddenError } from "@src/shared/errors";

export interface PasskeyProps {
  /** The WebAuthn credential id chosen by the authenticator (base64url), not a Vesta `Id`. */
  id: string;
  issuerId: string;
  vcHash: string;
  rpId: string;
  counter: number;
}

/**
 * A WebAuthn credential bound to one KYC credential of one issuer. Only `restore` exists:
 * registration still writes the row through Prisma, so the entity is born when a stored
 * passkey authenticates.
 */
export class Passkey {
  private readonly _id: string;
  private readonly _issuerId: string;
  private readonly _vcHash: string;
  private readonly _rpId: string;
  private _counter: number;

  private constructor(props: PasskeyProps) {
    this._id = props.id;
    this._issuerId = props.issuerId;
    this._vcHash = props.vcHash;
    this._rpId = props.rpId;
    this._counter = props.counter;
  }

  public get id(): string {
    return this._id;
  }
  public get issuerId(): string {
    return this._issuerId;
  }
  public get vcHash(): string {
    return this._vcHash;
  }
  public get rpId(): string {
    return this._rpId;
  }
  public get counter(): number {
    return this._counter;
  }

  public static restore(props: PasskeyProps): Passkey {
    return new Passkey(props);
  }

  /**
   * Applies the signature counter rule (WebAuthn L2, 6.1.1): a counter that does not
   * advance means the authenticator was cloned, so the assertion is refused. Zero on both
   * sides is accepted because synced passkeys (iCloud, Google) report 0 forever; the
   * signal only exists on device-bound keys.
   */
  public authenticate(newCounter: number): void {
    if ((this._counter > 0 || newCounter > 0) && newCounter <= this._counter) {
      throw new ForbiddenError("PASSKEY_COUNTER_REGRESSION", "Passkey signature counter did not advance", {
        issuerId: this._issuerId,
        passkeyId: this._id,
      });
    }
    this._counter = newCounter;
  }
}
