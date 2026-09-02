import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class CredentialRecoveryInput {
  @ApiProperty({ description: "One-time token issued after a verified Passkey assertion" })
  @IsString()
  @IsNotEmpty()
  public recoveryToken!: string;
}
