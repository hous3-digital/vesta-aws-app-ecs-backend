import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";

export class UserPublicCreateInput {
  @ApiProperty({ description: "User name", maxLength: 255, minLength: 3 })
  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  @Transform((value) => (value.value as string).trim())
  public name: string;

  @ApiProperty({ description: "User email", format: "email" })
  @IsNotEmpty()
  @IsEmail()
  @Transform((value) => (value.value as string).toLowerCase().trim())
  public email: string;

  @ApiProperty({ description: "User password", minLength: 8, maxLength: 255 })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @MaxLength(255)
  public password: string;
}
