/** Creation is the only response that ever carries the clear key. */
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
