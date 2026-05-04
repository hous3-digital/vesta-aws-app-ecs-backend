import { ApiProperty } from "@nestjs/swagger";

export class ApiDataResponse<T> {
  @ApiProperty()
  public data: T;
}
