import { ApiProperty } from "@nestjs/swagger";
import { FileStatus, FileType } from "@src/modules/file/domain/file.entity";
import { Expose } from "class-transformer";

export class FileOutput {
  @ApiProperty({ example: "file-123" })
  @Expose()
  id: string;

  @ApiProperty({ example: true })
  @Expose()
  isActive: boolean;

  @ApiProperty({ enum: FileStatus, example: FileStatus.Created })
  @Expose()
  status: FileStatus;

  @ApiProperty({ enum: FileType, example: FileType.UserAvatar })
  @Expose()
  type: FileType;

  @ApiProperty({ example: "image/png" })
  @Expose()
  contentType: string;

  @ApiProperty({ example: "tenant-assets" })
  @Expose()
  bucket: string;

  @ApiProperty({ example: "2021-01-01T00:00:00.000Z" })
  @Expose()
  createdAt: Date;

  @ApiProperty({ example: "2021-01-01T00:00:00.000Z" })
  @Expose()
  updatedAt: Date;

  @ApiProperty({ example: "2021-01-01T00:00:00.000Z", required: false, nullable: true })
  @Expose()
  deactivatedAt: Date | null;

  @ApiProperty({ example: "2021-01-01T00:00:00.000Z", required: false, nullable: true })
  @Expose()
  processingAt: Date | null;

  @ApiProperty({ example: "2021-01-01T00:00:00.000Z", required: false, nullable: true })
  @Expose()
  approvedAt: Date | null;

  @ApiProperty({ example: "2021-01-01T00:00:00.000Z", required: false, nullable: true })
  @Expose()
  reprovedAt: Date | null;

  @ApiProperty({ example: "Invalid file", required: false, nullable: true })
  @Expose()
  reason: string | null;

  @ApiProperty({ example: "person-123" })
  @Expose()
  parentId: string;
}
