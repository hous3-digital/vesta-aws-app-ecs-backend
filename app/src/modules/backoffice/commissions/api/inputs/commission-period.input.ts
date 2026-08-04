import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsISO8601, IsOptional } from "class-validator";
import { PeriodKey } from "@src/modules/backoffice/shared/period.util";

const PERIOD_VALUES: PeriodKey[] = ["Q1", "Q2", "Q3", "Q4", "custom"];

export class CommissionPeriodInput {
  @ApiPropertyOptional({ enum: PERIOD_VALUES, example: "Q2" })
  @IsOptional()
  @IsEnum(PERIOD_VALUES)
  public period?: PeriodKey;

  @ApiPropertyOptional({ example: "2026-04-01T00:00:00Z" })
  @IsOptional()
  @IsISO8601()
  public from?: string;

  @ApiPropertyOptional({ example: "2026-06-30T23:59:59Z" })
  @IsOptional()
  @IsISO8601()
  public to?: string;
}

export class CommissionTimeseriesInput extends CommissionPeriodInput {
  @ApiPropertyOptional({ enum: ["day"], default: "day" })
  @IsOptional()
  @IsEnum(["day"])
  public granularity?: "day";
}
