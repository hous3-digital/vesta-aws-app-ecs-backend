/** Creation and rotation are the only responses that ever carry the clear key. */
export interface ApiKeyCreatedOutput {
  id: string;
  issuerId: string;
  name: string;
  key: string;
  keyPrefix: string;
  createdAt: Date;
}

export interface ApiKeyRevokedOutput {
  revoked: true;
  id: string;
}

/** Rotation answers like a creation plus the key it replaces and when that one stops working. */
export interface ApiKeyRotatedOutput extends ApiKeyCreatedOutput {
  previous: { id: string; expiresAt: Date };
}
