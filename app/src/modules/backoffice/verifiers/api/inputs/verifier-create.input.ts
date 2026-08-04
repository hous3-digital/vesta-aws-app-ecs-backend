import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches, MaxLength } from "class-validator";

export class VerifierCreateInput {
  @ApiProperty({ example: "verifier_vulpay", description: "Identificador estavel do verifier (igual ao verifierId do SDK)" })
  @IsString()
  @Matches(/^[a-z0-9_]{3,64}$/, { message: "id deve ser snake_case ASCII (a-z 0-9 _), 3-64 chars" })
  public id!: string;

  @ApiProperty({ example: "Vulpay" })
  @IsString()
  @MaxLength(120)
  public name!: string;
}
