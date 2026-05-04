import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { UserInternalUpdateUserStatusByKycVeriffCommand } from "@src/modules/user/application/internal/commands/user-internal-update-user-status-by-kyc-veriff.command";

@CommandHandler(UserInternalUpdateUserStatusByKycVeriffCommand)
export class UserInternalUpdateUserStatusByKycVeriffHandler implements ICommandHandler<UserInternalUpdateUserStatusByKycVeriffCommand> {
  public async execute(_command: UserInternalUpdateUserStatusByKycVeriffCommand): Promise<void> {
    // IMPLEMENTATION
  }
}
