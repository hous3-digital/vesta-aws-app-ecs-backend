import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsString } from "class-validator";

const trim = ({ value }: { value: unknown }): unknown => (typeof value === "string" ? value.trim() : value);

export class ApiKeyAdminCreateInput {
  @ApiProperty({ example: "Production SDK" })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  public name!: string;

  @ApiProperty({ example: "acme_bank", description: "External id of the issuer the key belongs to" })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  public issuerId!: string;
}
