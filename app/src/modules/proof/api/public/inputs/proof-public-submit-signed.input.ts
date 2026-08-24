import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class ProofPublicSubmitSignedInput {
  @ApiProperty({ example: "prep_abc123..." })
  @IsString()
  public prepareSessionId!: string;

  @ApiProperty({ description: "Signed Stellar transaction XDR (base64)" })
  @IsString()
  public signedTxXdr!: string;

  @ApiProperty({
    description: "Privy access token; field name is retained for wire compatibility",
    required: false,
  })
  @IsOptional()
  @IsString()
  public privyIdentityToken?: string;
}
