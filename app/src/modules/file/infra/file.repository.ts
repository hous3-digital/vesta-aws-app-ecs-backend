import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@src/infra/database/@prisma/prisma.service";
import { File } from "@src/modules/file/domain/file.entity";
import { IFileRepository } from "@src/modules/file/domain/file.repository";
import { FileMapper } from "@src/modules/file/infra/file.mapper";
import { Id } from "@src/shared/value-objects/id.value-object";

@Injectable()
export class FileRepository implements IFileRepository {
  public constructor(private readonly prismaService: PrismaService) {}

  public async findByIdOrThrow(id: Id): Promise<File> {
    const file = await this.prismaService.file.findUnique({
      where: { id: id.value },
    });

    if (!file) {
      throw new NotFoundException("File not found");
    }

    return FileMapper.toDomain(file);
  }

  public async saveOrThrow(file: File): Promise<File> {
    await this.prismaService.file.updateMany({
      where: { parentId: file.parentId.value, type: file.type },
      data: { isActive: false },
    });

    await this.prismaService.file.create({
      data: {
        id: file.id.value,
        isActive: file.isActive,
        status: file.status,
        type: file.type,
        path: file.path.value,
        contentType: file.contentType,
        bucket: file.bucket,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
        deactivatedAt: file.deactivatedAt,
        parentId: file.parentId.value,
      },
    });

    return file;
  }

  public async updateOrThrow(file: File): Promise<File> {
    const data = FileMapper.toJSON(file);

    await this.prismaService.file.update({
      where: { id: file.id.value },
      data: data,
    });

    return file;
  }
}
