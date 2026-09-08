import { IsString, Matches } from "class-validator";

export class ConfirmWalletControlInput {
  @IsString()
  @Matches(/^[a-f0-9]{64}$/i)
  public challenge!: string;

  @IsString()
  @Matches(/^(0x)?[a-f0-9]{128}$/i)
  public signature!: string;
}

export class SubmitWalletTrustlineInput {
  @IsString()
  public unsignedXdr!: string;

  @IsString()
  @Matches(/^(0x)?[a-f0-9]{128}$/i)
  public signature!: string;
}
