import { ForbiddenException, Logger } from "@nestjs/common";
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { AuthOutput } from "@src/modules/auth/api/common/auth.output";
import { AuthPublicAuthorizeCreateCommand } from "@src/modules/auth/application/public/commands/auth-public-authorize-create.command";
import { IAuthService } from "@src/modules/auth/domain/auth.service";
import { IMembershipRepository } from "@src/modules/membership/domain/membership.repository";

@CommandHandler(AuthPublicAuthorizeCreateCommand)
export class AuthPublicAuthorizeCreateHandler implements ICommandHandler<AuthPublicAuthorizeCreateCommand> {
  private readonly logger = new Logger(AuthPublicAuthorizeCreateHandler.name);

  public constructor(
    private readonly membershipRepository: IMembershipRepository,
    private readonly authService: IAuthService,
  ) {}

  public async execute(command: AuthPublicAuthorizeCreateCommand): Promise<AuthOutput> {
    const { membershipId, user: requester } = command;

    try {
      const membership = await this.membershipRepository.findByIdOrThrow(membershipId);
      const isTheSameUser = membership.userId.equals(requester.id);

      if (!isTheSameUser) {
        throw new ForbiddenException("You are not allowed to authorize this user");
      }

      const payload = { sub: membership.userId.value, membershipId: membership.id.value };
      const accessToken = this.authService.createAuthenticateToken(payload, "7d");

      return { accessToken: accessToken };
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw error;
    }
  }
}
