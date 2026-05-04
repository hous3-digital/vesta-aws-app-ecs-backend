import {
  Controller,
  Get,
  Param,
  ParseFilePipe,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { AuthAuthorizeGuard } from "@src/modules/auth/api/common/auth-authorize.guard";
import { FileMulterUploadInput } from "@src/modules/file/api/common/file-multer-upload.input";
import { FileOutput } from "@src/modules/file/api/common/file.output";
import { FilePublicDownloadPathParam } from "@src/modules/file/api/public/params/file-public-download-path.param";
import { FilePublicDownloadCommand } from "@src/modules/file/application/public/commands/file-public-download.command";
import { FilePublicUserAvatarUploadCommand } from "@src/modules/file/application/public/commands/file-public-user-avatar-upload.command";
import { File, FileType } from "@src/modules/file/domain/file.entity";
import { FileMapper } from "@src/modules/file/infra/file.mapper";
import { validators } from "@src/modules/file/infra/file.validator";
import { MembershipCurrent } from "@src/modules/membership/api/common/membership-current.decorator";
import { Membership } from "@src/modules/membership/domain/membership.entity";
import { Id } from "@src/shared/value-objects/id.value-object";
import { ApiCreatedResponseData } from "@src/utils/decorators/api-created-response-data.decorator";
import { toOutput } from "@src/utils/helpers/to-output.helper";
import {
  ApiBadRequestErrorOutput,
  ApiForbiddenErrorOutput,
  ApiInternalServerErrorOutput,
  ApiNotFoundErrorOutput,
  ApiUnauthorizedErrorOutput,
} from "@src/utils/types/api.output";
import { swaggerFileSchema } from "@src/utils/types/swagger-file.type";
import { Response } from "express";

@ApiTags("file")
@Controller("file/public")
export class FilePublicController {
  public constructor(private readonly commandBus: CommandBus) {}

  @ApiBearerAuth()
  @ApiOperation({ summary: "Download file" })
  @ApiResponse({
    status: 200,
    description: "File downloaded successfully",
    schema: { type: "string", format: "binary" },
  })
  @ApiBadRequestResponse({ type: ApiBadRequestErrorOutput })
  @ApiUnauthorizedResponse({ type: ApiUnauthorizedErrorOutput })
  @ApiNotFoundResponse({ type: ApiNotFoundErrorOutput })
  @ApiForbiddenResponse({ type: ApiForbiddenErrorOutput })
  @ApiInternalServerErrorResponse({ type: ApiInternalServerErrorOutput })
  @UseGuards(AuthAuthorizeGuard)
  @Get("/download/:id")
  public async download(
    @Param() pathParam: FilePublicDownloadPathParam,
    @Res({ passthrough: false }) response: Response,
  ): Promise<void> {
    const fileId = Id.restore(pathParam.id);
    const file = await this.commandBus.execute(new FilePublicDownloadCommand(fileId));

    response.set({
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename=${file.id.value}`,
      "Content-Length": file.buffer.length,
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: 0,
    });

    response.end(file.buffer);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: "Upload user avatar" })
  @ApiBody(swaggerFileSchema)
  @ApiCreatedResponseData(FileOutput)
  @ApiBadRequestResponse({ type: ApiBadRequestErrorOutput })
  @ApiUnauthorizedResponse({ type: ApiUnauthorizedErrorOutput })
  @ApiNotFoundResponse({ type: ApiNotFoundErrorOutput })
  @ApiForbiddenResponse({ type: ApiForbiddenErrorOutput })
  @ApiInternalServerErrorResponse({ type: ApiInternalServerErrorOutput })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file"))
  @UseGuards(AuthAuthorizeGuard)
  @Post("/upload/user/avatar")
  public async uploadUserAvatar(
    @UploadedFile(new ParseFilePipe({ validators: validators[FileType.UserAvatar] }))
    input: FileMulterUploadInput,
    @MembershipCurrent() membership: Membership,
  ): Promise<FileOutput> {
    const command = new FilePublicUserAvatarUploadCommand(input.buffer, input.mimetype, membership);
    const file = await this.commandBus.execute<FilePublicUserAvatarUploadCommand, File>(command);
    return toOutput(FileOutput, FileMapper.toJSON(file));
  }
}
