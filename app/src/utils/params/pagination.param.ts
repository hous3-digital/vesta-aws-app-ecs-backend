import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class PaginationParam {
  @ApiProperty({ description: "The search query", required: false })
  @IsString()
  @IsOptional()
  public searchQuery?: string;

  @ApiProperty({ description: "The page number", required: false, default: 1 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  public pageNumber?: number = 1;

  @ApiProperty({ description: "The number of items per page", required: false, default: 5 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  public pageSize: number = 5;
}
