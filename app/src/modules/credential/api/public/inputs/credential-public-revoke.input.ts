import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class CredentialPublicRevokeInput {
  @ApiProperty({ example: "abc123..." })
  @IsString()
  public vcHash!: string;

  @ApiPropertyOptional({ example: "Documento inválido" })
  @IsOptional()
  @IsString()
  public reason?: string;
}
