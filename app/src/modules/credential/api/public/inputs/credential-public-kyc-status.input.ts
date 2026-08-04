import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { IsValidCpf } from "@src/shared/validators/is-valid-cpf.validator";
import type { KycLevel } from "@src/shared/types/vesta-vc.types";

export type KycStatusDecision = "approved" | "rejected";

export class CredentialPublicKycStatusInput {
  @ApiProperty({ example: "12345678900" })
  @IsValidCpf()
  public cpf!: string;

  @ApiProperty({ enum: ["approved", "rejected"] })
  @IsIn(["approved", "rejected"])
  public status!: KycStatusDecision;

  @ApiProperty({ enum: ["basic", "intermediate", "complete"] })
  @IsIn(["basic", "intermediate", "complete"])
  public kycLevel!: Exclude<KycLevel, "pending">;

  @ApiPropertyOptional({ example: "Documento ilegível" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  public reason?: string;
}
