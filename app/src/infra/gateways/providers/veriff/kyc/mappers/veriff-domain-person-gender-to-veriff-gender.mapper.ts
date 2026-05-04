import { UnprocessableEntityException } from "@nestjs/common";

const VeriffKycDomainPersonGenderToVeriffGenderMap: Record<string, string> = {
  male: "M",
  female: "F",
};

export class VeriffKycDomainPersonGenderToVeriffGenderMapper {
  public static parse(value: string): string {
    const isValid = Object.keys(VeriffKycDomainPersonGenderToVeriffGenderMap).includes(value);

    if (isValid) {
      const gender = VeriffKycDomainPersonGenderToVeriffGenderMap[value];
      return gender;
    }

    throw new UnprocessableEntityException(`Invalid conversion from PersonGender ${value} to VeriffGender`);
  }
}
