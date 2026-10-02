/** What `/public/proof/submit-signed` needs from `/prepare`. A one-time token, not an aggregate: no entity. */
export interface PrepareSession {
  vcHash: string;
  proofHash: string;
  kycLevel: string;
  verifierId: string;
  issuerId: string | null;
  issuerDid: string | null;
  userWalletAddress: string | null;
  /** Stellar address that must sign the inner transaction: the deployer or the holder's wallet. */
  expectedSource: string;
  innerTxHash: string;
  sourceAccountSignedByBackend: boolean;
  mock: boolean;
  zkProof: {
    protocol: string;
    curve: string;
    publicSignals: string[];
  };
}

/** The SDK has this long between `prepare` and `submit-signed`; the holder signs in between. */
export const PREPARE_SESSION_TTL_SECONDS = 90;

/**
 * Single-use session between prepare and submit-signed. The id is a bearer: `create` returns
 * `prep_` + 32 hex and `consume` hands the session back exactly once, atomically; unknown, expired
 * or already consumed is `null`. Bound in proof.module.ts to Postgres, or to Redis when REDIS_URL is set.
 */
export abstract class IPrepareSessionStore {
  public abstract create(session: PrepareSession, ttlSeconds: number): Promise<string>;
  public abstract consume(sessionId: string): Promise<PrepareSession | null>;
}
