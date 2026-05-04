import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";

export class PaginationOutput {
  @ApiProperty({ description: "The page number", example: 1 })
  @Expose()
  public pageNumber: number;

  @ApiProperty({ description: "The number of items per page", example: 10 })
  @Expose()
  public pageSize: number;

  @ApiProperty({ description: "The total number of items", example: 100 })
  @Expose()
  public totalRecords: number;

  @ApiProperty({ description: "The total number of pages", example: 10 })
  @Expose()
  public totalPages: number;
}
