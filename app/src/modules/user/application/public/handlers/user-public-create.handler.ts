import { ConflictException, Injectable } from "@nestjs/common";
import { CommandHandler, EventBus, ICommandHandler } from "@nestjs/cqrs";
import { Membership } from "@src/modules/membership/domain/membership.entity";
import { IMembershipRepository } from "@src/modules/membership/domain/membership.repository";
import { RoleType } from "@src/modules/role/domain/role.entity";
import { IRoleRepository } from "@src/modules/role/domain/role.repository";
import { UserPublicCreateCommand } from "@src/modules/user/application/public/commands/user-public-create.command";
import { User } from "@src/modules/user/domain/user.entity";
import { IUserRepository } from "@src/modules/user/domain/user.repository";
import { Name } from "@src/shared/value-objects/name.value-object";
import { Password } from "@src/shared/value-objects/password.value-object";

@Injectable()
@CommandHandler(UserPublicCreateCommand)
export class UserPublicCreateHandler implements ICommandHandler<UserPublicCreateCommand> {
  public constructor(
    private readonly userRepository: IUserRepository,
    private readonly membershipRepository: IMembershipRepository,
    private readonly eventBus: EventBus,
    private readonly roleRepository: IRoleRepository,
  ) {}

  public async execute(command: UserPublicCreateCommand): Promise<User> {
    const existingUser = await this.userRepository.findByEmail(command.email);

    if (existingUser) {
      throw new ConflictException("Email already taken");
    }

    const name = Name.create(command.name);
    const password = Password.create(command.password);
    const email = command.email;
    const user = User.create(name, email, password);
    await this.userRepository.saveOrThrow(user);

    const role = await this.roleRepository.findByTypeOrThrow(RoleType.User);

    const membership = Membership.create(user.id, role.id);
    await this.membershipRepository.saveOrThrow(membership);

    const event = user.toEvent();
    await this.eventBus.publish(event);

    return user;
  }
}
