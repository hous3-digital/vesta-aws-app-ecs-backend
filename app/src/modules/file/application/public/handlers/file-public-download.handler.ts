import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { StorageFactory } from "@src/infra/gateways/ports/storage/storage.factory";
import { IStoragePort, StorageDownloadInput } from "@src/infra/gateways/ports/storage/storage.port";
import { FilePublicDownloadCommand } from "@src/modules/file/application/public/commands/file-public-download.command";
import { IFileRepository } from "@src/modules/file/domain/file.repository";

@CommandHandler(FilePublicDownloadCommand)
export class FilePublicDownloadHandler implements ICommandHandler<FilePublicDownloadCommand> {
  private readonly logger = new Logger(FilePublicDownloadHandler.name);

  public constructor(
    @Inject(StorageFactory) private readonly storage: IStoragePort,
    private readonly fileRepository: IFileRepository,
  ) {}

  public async execute(command: FilePublicDownloadCommand) {
    const { fileId } = command;

    try {
      const file = await this.fileRepository.findByIdOrThrow(fileId);

      const downloadInput: StorageDownloadInput = { file: file };
      const downloaded = await this.storage.download(downloadInput);

      return {
        id: file.id,
        contentType: file.contentType,
        buffer: downloaded.buffer,
      };
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw error;
    }
  }
}
