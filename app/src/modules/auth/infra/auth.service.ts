import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { IAuthService } from "@src/modules/auth/domain/auth.service";
import type { StringValue } from "ms";

@Injectable()
export class AuthService implements IAuthService {
  public constructor(private readonly jwtService: JwtService) {}

  public createAuthenticateToken(payload: any, expiresIn: StringValue): string {
    const accessToken = this.jwtService.sign(payload, { expiresIn: expiresIn });
    return accessToken;
  }
}
