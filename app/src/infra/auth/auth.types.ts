export interface ApiKeyContext {
  apiKeyId: string;
  issuerId: string;
}

export interface BackofficeSession {
  userId: string;
  issuerId: string;
  email: string;
  name: string | null;
}

export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  apiKey?: ApiKeyContext;
  backofficeUser?: BackofficeSession;
}
