import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
import { typeid } from "typeid-js";

export class UserBackofficeDeactivatePathParam {
  @ApiProperty({
    description: "The id of the user to deactivate",
    example: typeid("user").toString(),
  })
  @IsString()
  @IsNotEmpty()
  public id: string;
}
