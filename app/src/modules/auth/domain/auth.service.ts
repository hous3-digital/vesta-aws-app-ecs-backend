export abstract class IAuthService {
  abstract createAuthenticateToken(payload: any, expiresIn: string): string;
}
