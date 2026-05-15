import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class CredentialPublicVerifyInput {
  @ApiProperty({ example: "abc123..." })
  @IsString()
  public vcHash!: string;
}
