import { Logger, UnauthorizedException } from "@nestjs/common";
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { AuthOutput } from "@src/modules/auth/api/common/auth.output";
import { AuthPublicAuthenticateCreateCommand } from "@src/modules/auth/application/public/commands/auth-public-authenticate-create.command";
import { IAuthService } from "@src/modules/auth/domain/auth.service";
import { IUserRepository } from "@src/modules/user/domain/user.repository";

@CommandHandler(AuthPublicAuthenticateCreateCommand)
export class AuthPublicAuthenticateCreateHandler implements ICommandHandler<AuthPublicAuthenticateCreateCommand> {
  private readonly logger = new Logger(AuthPublicAuthenticateCreateHandler.name);

  public constructor(
    private readonly userRepository: IUserRepository,
    private readonly authService: IAuthService,
  ) {}

  public async execute(command: AuthPublicAuthenticateCreateCommand): Promise<AuthOutput> {
    const { email, password } = command;

    try {
      const user = await this.userRepository.findByEmail(email);

      if (!user) {
        throw new UnauthorizedException("Invalid credentials");
      }

      const match = user.password.match(password);

      if (!match) {
        throw new UnauthorizedException("Invalid credentials");
      }

      const payload = { sub: user.id.value };
      const accessToken = this.authService.createAuthenticateToken(payload, "10m");

      return { accessToken: accessToken };
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw error;
    }
  }
}
