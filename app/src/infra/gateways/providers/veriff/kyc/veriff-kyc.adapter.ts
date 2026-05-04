import { Injectable } from "@nestjs/common";
import { IKycPort, KycStartInput, KycStartOutput } from "@src/infra/gateways/ports/kyc/kyc.port";
import { VeriffKycService } from "@src/infra/gateways/providers/veriff/kyc/veriff-kyc.service";
import { VeriffCreateSessionInput } from "@src/infra/gateways/providers/veriff/kyc/veriff-kyc.type";
import { IUserRepository } from "@src/modules/user/domain/user.repository";

@Injectable()
export class VeriffKycAdapter implements IKycPort {
  public constructor(
    private readonly userRepository: IUserRepository,
    private readonly veriffKycService: VeriffKycService,
  ) {}

  public async start(input: KycStartInput): Promise<KycStartOutput> {
    const user = await this.userRepository.findByIdOrThrow(input.userId);

    const veriffInput: VeriffCreateSessionInput = {
      userId: user.id,
      profile: {
        firstName: user.name.getFirstName(),
        lastName: user.name.getLastName(),
        gender: "male",
        dateOfBirth: new Date("1990-01-01"),
        maritalStatus: "single",
        occupation: "software engineer",
      },
      document: {
        identificationType: "rg",
        identificationNumber: "1234567890",
        identificationDateOfIssue: new Date("2020-01-01"),
      },
      address: "123 Main St, Anytown, USA",
      contact: {
        phone: "+1234567890",
        email: user.email,
      },
      callbackUrl: "https://example.com/callback",
    };

    const result = await this.veriffKycService.createSession(veriffInput);

    return { reference: result.data.reference, url: result.data.url };
  }
}
