import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
import { typeid } from "typeid-js";

export class FilePublicDownloadPathParam {
  @ApiProperty({ description: "File ID", example: typeid("file").toString() })
  @IsNotEmpty()
  @IsString()
  public id: string;
}
