import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";

export class AuthPublicAuthenticateCreateInput {
  @ApiProperty({ description: "User email", format: "email" })
  @IsNotEmpty()
  @IsEmail()
  @Transform((value) => (value.value as string).toLowerCase().trim())
  public email: string;

  @ApiProperty({ description: "User password", minLength: 8, maxLength: 20 })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  public password: string;
}
