import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { CredentialStatus } from "@src/infra/database/@prisma/generated/client";

export class CredentialListInput {
  @ApiPropertyOptional({ enum: CredentialStatus, example: CredentialStatus.ACTIVE })
  @IsOptional()
  @IsEnum(CredentialStatus)
  public status?: CredentialStatus;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  public limit?: number;

  @ApiPropertyOptional({ description: "Cursor opaco vindo de nextCursor da pagina anterior" })
  @IsOptional()
  @IsString()
  public cursor?: string;
}
