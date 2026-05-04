import { ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { EnvService } from "@src/infra/env/env.service";
import { AuthBaseGuard } from "@src/modules/auth/api/common/auth-base.guard";
import { IUserRepository } from "@src/modules/user/domain/user.repository";
import { Id } from "@src/shared/value-objects/id.value-object";

@Injectable()
export class AuthAuthenticateGuard extends AuthBaseGuard {
  public constructor(
    protected readonly jwtService: JwtService,
    protected readonly envService: EnvService,
    private readonly userRepository: IUserRepository,
  ) {
    super(jwtService, envService);
  }

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = super.getRequest(context);
    const accessToken = super.getAccessToken(request);

    if (!accessToken) {
      throw new UnauthorizedException("Authorization not found");
    }

    const payload = super.getPayload(accessToken);

    if (!payload) {
      throw new UnauthorizedException("Invalid token");
    }

    const userId = Id.restore(payload.sub);
    const user = await this.userRepository.findByIdOrThrow(userId);

    request.user = user;

    return true;
  }
}
