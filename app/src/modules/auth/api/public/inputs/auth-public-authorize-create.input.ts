import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";
import { typeid } from "typeid-js";

export class AuthPublicAuthorizeCreateInput {
  @ApiProperty({ description: "Membership id", example: typeid("membership").toString() })
  @IsNotEmpty()
  public membershipId: string;
}
