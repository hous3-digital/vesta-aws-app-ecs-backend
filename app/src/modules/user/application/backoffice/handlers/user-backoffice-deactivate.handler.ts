import { Injectable } from "@nestjs/common";
import { CommandHandler, EventBus, ICommandHandler } from "@nestjs/cqrs";
import { UserBackofficeDeactivateCommand } from "@src/modules/user/application/backoffice/commands/user-backoffice-deactivate.command";
import { User } from "@src/modules/user/domain/user.entity";
import { IUserRepository } from "@src/modules/user/domain/user.repository";

@Injectable()
@CommandHandler(UserBackofficeDeactivateCommand)
export class UserBackofficeDeactivateHandler implements ICommandHandler<UserBackofficeDeactivateCommand> {
  public constructor(
    private readonly userRepository: IUserRepository,
    private readonly eventBus: EventBus,
  ) {}

  public async execute(command: UserBackofficeDeactivateCommand): Promise<User> {
    const user = await this.userRepository.findByIdOrThrow(command.userId);

    user.deactivate();
    await this.userRepository.updateOrThrow(user);

    const event = user.toEvent();
    await this.eventBus.publish(event);

    return user;
  }
}
