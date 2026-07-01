import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from "class-validator";

export enum VerificationStatusFilter {
  Completed = "completed",
  Failed = "failed",
}

export class VerificationListInput {
  @ApiPropertyOptional({ example: "verifier_vulpay" })
  @IsOptional()
  @IsString()
  public verifierId?: string;

  @ApiPropertyOptional({ enum: VerificationStatusFilter })
  @IsOptional()
  @IsEnum(VerificationStatusFilter)
  public status?: VerificationStatusFilter;

  @ApiPropertyOptional({ example: "2026-04-01T00:00:00Z" })
  @IsOptional()
  @IsISO8601()
  public from?: string;

  @ApiPropertyOptional({ example: "2026-06-30T23:59:59Z" })
  @IsOptional()
  @IsISO8601()
  public to?: string;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  public limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public cursor?: string;
}
