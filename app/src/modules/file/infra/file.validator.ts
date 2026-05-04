import { FileTypeValidator, FileValidator, MaxFileSizeValidator } from "@nestjs/common";
import { FileType } from "@src/modules/file/domain/file.entity";

// TODO: Add more file types and sizes

export const validators: { [K in FileType]: FileValidator[] } = {
  [FileType.UserAvatar]: [
    new FileTypeValidator({ fileType: ".(jpg|jpeg|png)" }),
    new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 10 }), // 10MB
  ],
};
