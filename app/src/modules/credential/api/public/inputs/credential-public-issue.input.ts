import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import type { KycLevel } from "@src/shared/types/vesta-vc.types";

export class CredentialPublicIssueInput {
  @ApiProperty({ example: "issuer_01jz..." })
  @IsString()
  public issuerId!: string;

  @ApiProperty({ example: "12345678900" })
  @IsString()
  public cpf!: string;

  @ApiProperty({ example: "Maria Silva" })
  @IsString()
  public fullName!: string;

  @ApiProperty({ example: "1990-05-20" })
  @IsString()
  public birthDate!: string;

  @ApiProperty({ enum: ["basic", "intermediate", "complete"] })
  @IsIn(["basic", "intermediate", "complete"])
  public kycLevel!: KycLevel;

  @ApiProperty({ example: "document_ocr" })
  @IsString()
  public kycMethod!: string;

  @ApiPropertyOptional({ example: "BR" })
  @IsOptional()
  @IsString()
  public nationality?: string;

  @ApiPropertyOptional({ example: 365 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  public expirationDays?: number;
}
