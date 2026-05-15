import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsObject, IsString } from "class-validator";

export class ProofPublicSubmitInput {
  @ApiProperty({ example: "abc123..." })
  @IsString()
  public vcHash!: string;

  @ApiProperty({ description: "Groth16 proof object (pi_a, pi_b, pi_c, protocol, curve)" })
  @IsObject()
  public proof!: { pi_a: string[]; pi_b: string[][]; pi_c: string[]; protocol?: string; curve?: string };

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  public publicSignals!: string[];

  @ApiProperty({ example: "verifier-app-id" })
  @IsString()
  public verifierId!: string;
}
