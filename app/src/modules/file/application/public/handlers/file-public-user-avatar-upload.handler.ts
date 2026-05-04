import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { EnvService } from "@src/infra/env/env.service";
import { StorageFactory } from "@src/infra/gateways/ports/storage/storage.factory";
import { IStoragePort, StorageUploadInput } from "@src/infra/gateways/ports/storage/storage.port";
import { FilePublicUserAvatarUploadCommand } from "@src/modules/file/application/public/commands/file-public-user-avatar-upload.command";
import { File, FileType } from "@src/modules/file/domain/file.entity";
import { IFileRepository } from "@src/modules/file/domain/file.repository";

@CommandHandler(FilePublicUserAvatarUploadCommand)
export class FilePublicUserAvatarUploadHandler implements ICommandHandler<FilePublicUserAvatarUploadCommand> {
  private readonly logger = new Logger(FilePublicUserAvatarUploadHandler.name);

  public constructor(
    @Inject(StorageFactory) private readonly storage: IStoragePort,
    private readonly fileRepository: IFileRepository,
    private readonly envService: EnvService,
  ) {}

  public async execute(command: FilePublicUserAvatarUploadCommand): Promise<File> {
    const { membership, buffer, mimetype } = command;

    try {
      const bucket = this.envService.AWS_S3_PUBLIC_BUCKET;
      const file = File.create(FileType.UserAvatar, membership.userId, mimetype, bucket);

      const uploadInput: StorageUploadInput = {
        file: file,
        buffer: buffer,
      };

      await this.storage.upload(uploadInput);
      await this.fileRepository.saveOrThrow(file);

      return file;
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw error;
    }
  }
}
