import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";

export class AuthOutput {
  @ApiProperty({ example: "JWT_TOKEN" })
  @Expose()
  public accessToken: string;
}
