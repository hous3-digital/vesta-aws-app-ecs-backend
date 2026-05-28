import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsObject, IsString, Matches, Max, MaxLength, Min, ValidateNested } from "class-validator";
import { IsValidCpf } from "@src/shared/validators/is-valid-cpf.validator";

class PrivateInputsInput {
  @ApiProperty({ example: "12345678900" })
  @IsValidCpf()
  public cpf!: string;

  @ApiProperty({ example: "19900520" })
  @Matches(/^\d{8}$/, { message: "birthDate must be in YYYYMMDD format" })
  public birthDate!: string;

  @ApiProperty({ example: "Maria Silva" })
  @IsString()
  @MaxLength(100)
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

  @ApiProperty({ example: "abc123def..." })
  @IsString()
  public challenge!: string;
}
