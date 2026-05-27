import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsObject, IsOptional, IsString, Max, Min, ValidateNested } from "class-validator";

class PrivateInputsInput {
  @ApiProperty({ example: "12345678900" })
  @IsString()
  public cpf!: string;

  @ApiProperty({ example: "19900520" })
  @IsString()
  public birthDate!: string;

  @ApiProperty({ example: "Maria Silva" })
  @IsString()
  public fullName!: string;
}

export class ProofPublicGenerateAndSubmitInput {
  @ApiProperty({ description: "VestaVC object as returned by POST /public/credential" })
  @IsObject()
  public vc!: Record<string, unknown>;

  @ApiProperty({ type: PrivateInputsInput })
  @ValidateNested()
  @Type(() => PrivateInputsInput)
  public privateInputs!: PrivateInputsInput;

  @ApiProperty({ example: "verifier-app-id" })
  @IsString()
  public verifierId!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  @Max(3)
  public minKycLevel!: number;

  @ApiPropertyOptional({ example: "abc123def..." })
  @IsOptional()
  @IsString()
  public challenge?: string;
}
