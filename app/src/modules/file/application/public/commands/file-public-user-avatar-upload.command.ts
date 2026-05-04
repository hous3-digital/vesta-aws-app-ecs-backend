import { Membership } from "@src/modules/membership/domain/membership.entity";

export class FilePublicUserAvatarUploadCommand {
  public constructor(
    public readonly buffer: Buffer,
    public readonly mimetype: string,
    public readonly membership: Membership,
  ) {}
}
