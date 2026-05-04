import { File as FilePrisma } from "@prisma/client";
import { FilePath } from "@src/modules/file/domain/file-path.value-object";
import { File, FileStatus, FileType } from "@src/modules/file/domain/file.entity";
import { Id } from "@src/shared/value-objects/id.value-object";

export class FileMapper {
  public static toDomain(prisma: FilePrisma): File {
    return File.restore({
      id: Id.restore(prisma.id),
      isActive: prisma.isActive,
      status: prisma.status as FileStatus,
      type: prisma.type as FileType,
      path: FilePath.restore(prisma.path),
      contentType: prisma.contentType as string,
      bucket: prisma.bucket,
      createdAt: prisma.createdAt,
      updatedAt: prisma.updatedAt,
      deactivatedAt: prisma.deactivatedAt,
      processingAt: prisma.processingAt,
      approvedAt: prisma.approvedAt,
      reprovedAt: prisma.reprovedAt,
      reason: prisma.reason,
      parentId: Id.restore(prisma.parentId),
    });
  }

  public static toJSON(domain: File): FilePrisma {
    return {
      id: domain.id.value,
      isActive: domain.isActive,
      status: domain.status,
      type: domain.type,
      path: domain.path.value,
      contentType: domain.contentType,
      bucket: domain.bucket,
      createdAt: domain.createdAt,
      updatedAt: domain.updatedAt,
      deactivatedAt: domain.deactivatedAt,
      processingAt: domain.processingAt,
      approvedAt: domain.approvedAt,
      reprovedAt: domain.reprovedAt,
      reason: domain.reason,
      parentId: domain.parentId.value,
    };
  }
}
