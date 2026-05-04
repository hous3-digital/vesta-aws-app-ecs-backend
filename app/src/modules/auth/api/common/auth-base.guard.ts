import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { JwtPayload } from "@src/infra/cipher/jwt/jwt.type";
import { EnvService } from "@src/infra/env/env.service";

@Injectable()
export class AuthBaseGuard implements CanActivate {
  public constructor(
    protected readonly jwtService: JwtService,
    protected readonly envService: EnvService,
  ) {}

  protected getRequest(context: ExecutionContext): any {
    const request = context.switchToHttp().getRequest();

    return request;
  }

  private parseAccessTokenFromHeader(request: any): string | undefined {
    try {
      const header = request.headers.authorization as string | undefined;

      if (header) {
        const accessToken = header.split(" ")[1];
        return accessToken;
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  protected getAccessToken(request: any): string | undefined {
    const accessToken = this.parseAccessTokenFromHeader(request);
    return accessToken;
  }

  private parse(accessToken: string): JwtPayload | undefined {
    try {
      this.jwtService.verify(accessToken);
      const payload = this.jwtService.decode<JwtPayload>(accessToken);
      return payload;
    } catch {
      return undefined;
    }
  }

  protected getPayload(accessToken: string): JwtPayload | undefined {
    const payload = this.parse(accessToken);
    return payload;
  }

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    return !!context;
  }
}
