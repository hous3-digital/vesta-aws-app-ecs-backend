import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";
import { VerifierStatus } from "@src/modules/backoffice/verifiers/domain/verifier.entity";

export class VerifierUpdateStatusInput {
  @ApiProperty({ enum: VerifierStatus, example: VerifierStatus.Revoked })
  @IsEnum(VerifierStatus)
  public status!: VerifierStatus;
}
