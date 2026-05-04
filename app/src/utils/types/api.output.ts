import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";

export class ApiBadRequestErrorOutput {
  @ApiProperty({ example: "Bad Request" })
  @Expose()
  public message: string;

  @ApiProperty({ example: "Bad Request" })
  @Expose()
  public error: string;

  @ApiProperty({ example: 400 })
  @Expose()
  public statusCode: number;
}

export class ApiUnauthorizedErrorOutput {
  @ApiProperty({ example: "Authorization not found" })
  @Expose()
  public message: string;

  @ApiProperty({ example: "Unauthorized" })
  @Expose()
  public error: string;

  @ApiProperty({ example: 401 })
  @Expose()
  public statusCode: number;
}

export class ApiForbiddenErrorOutput {
  @ApiProperty({ example: "You are not allowed to access this resource" })
  @Expose()
  public message: string;

  @ApiProperty({ example: "Forbidden" })
  @Expose()
  public error: string;

  @ApiProperty({ example: 403 })
  @Expose()
  public statusCode: number;
}

export class ApiNotFoundErrorOutput {
  @ApiProperty({ example: "Resource not found" })
  @Expose()
  public message: string;

  @ApiProperty({ example: "Not Found" })
  @Expose()
  public error: string;

  @ApiProperty({ example: 404 })
  @Expose()
  public statusCode: number;
}

export class ApiConflictErrorOutput {
  @ApiProperty({ example: "Resource already taken" })
  @Expose()
  public message: string;

  @ApiProperty({ example: "Conflict" })
  @Expose()
  public error: string;

  @ApiProperty({ example: 409 })
  @Expose()
  public statusCode: number;
}

export class ApiInternalServerErrorOutput {
  @ApiProperty({ example: "Internal Server Error" })
  @Expose()
  public message: string;

  @ApiProperty({ example: "Internal Server Error" })
  @Expose()
  public error: string;

  @ApiProperty({ example: 500 })
  @Expose()
  public statusCode: number;
}
