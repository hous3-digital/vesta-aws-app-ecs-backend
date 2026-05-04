import { UnprocessableEntityException } from "@nestjs/common";

const VeriffKycDomainDocumentTypeToVeriffDocumentTypeMap: Partial<Record<string, string>> = {
  rg: "ID_CARD",
  cnh: "DRIVERS_LICENSE",
  passport: "PASSPORT",
};

export class VeriffKycDomainDocumentTypeToVeriffDocumentTypeMapper {
  public static parse(value: string): string {
    const isValid = Object.keys(VeriffKycDomainDocumentTypeToVeriffDocumentTypeMap).includes(value);

    if (isValid) {
      const type = VeriffKycDomainDocumentTypeToVeriffDocumentTypeMapper[value];
      return type;
    }

    throw new UnprocessableEntityException(`Invalid conversion from DomainDocumentType ${value} to VeriffDocumentType`);
  }
}
