import { ApiProperty } from "@nestjs/swagger";
import { IsObject, IsString, Length, Matches } from "class-validator";

export class PasskeyRegistrationOptionsInput {
  @ApiProperty()
  @IsString()
  @Matches(/^[a-f0-9]{64}$/i)
  public vcHash!: string;

  @ApiProperty({ example: "app.example.com" })
  @IsString()
  @Length(1, 253)
  public rpId!: string;
}

export class PasskeyAuthenticationOptionsInput {
  @ApiProperty({ example: "app.example.com" })
  @IsString()
  @Length(1, 253)
  public rpId!: string;
}

export class PasskeyRegistrationVerifyInput {
  @ApiProperty()
  @IsString()
  public challenge!: string;

  @ApiProperty()
  @IsObject()
  public response!: Record<string, unknown>;
}

export class PasskeyAuthenticationVerifyInput extends PasskeyRegistrationVerifyInput {}
