import { ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { EnvService } from "@src/infra/env/env.service";
import { AuthBaseGuard } from "@src/modules/auth/api/common/auth-base.guard";
import { IMembershipRepository } from "@src/modules/membership/domain/membership.repository";
import { IRoleRepository } from "@src/modules/role/domain/role.repository";
import { IUserRepository } from "@src/modules/user/domain/user.repository";
import { Id } from "@src/shared/value-objects/id.value-object";

@Injectable()
export class AuthAuthorizeGuard extends AuthBaseGuard {
  public constructor(
    protected readonly jwtService: JwtService,
    protected readonly envService: EnvService,
    private readonly userRepository: IUserRepository,
    private readonly membershipRepository: IMembershipRepository,
    private readonly roleRepository: IRoleRepository,
    private readonly reflector: Reflector,
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

    const membershipId = Id.restore(payload.membershipId);
    const membership = await this.membershipRepository.findByIdOrThrow(membershipId);
    const role = await this.roleRepository.findByIdOrThrow(membership.roleId);
    const roles = [role.type];

    const contextRoles = this.reflector.get<string[] | undefined>("roles", context.getHandler());

    if (!contextRoles || roles.some((userRole) => contextRoles.includes(userRole))) {
      request.user = user;
      request.role = role;
      request.membership = membership;

      return true;
    }

    throw new ForbiddenException("You are not allowed to execute this action");
  }
}
