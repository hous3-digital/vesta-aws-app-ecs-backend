import { Injectable, Logger } from "@nestjs/common";
import { EnvService } from "@src/infra/env/env.service";
import { VeriffKycDomainDocumentTypeToVeriffDocumentTypeMapper } from "@src/infra/gateways/providers/veriff/kyc/mappers/veriff-domain-document-type-to-veriff-document-type.mapper";
import { VeriffKycDomainPersonGenderToVeriffGenderMapper } from "@src/infra/gateways/providers/veriff/kyc/mappers/veriff-domain-person-gender-to-veriff-gender.mapper";
import {
  VeriffCreateSessionInput,
  VeriffCreateSessionOutput,
} from "@src/infra/gateways/providers/veriff/kyc/veriff-kyc.type";
import { EgressService } from "@src/infra/logging/egress/infra/egress.service";
import { handleHttpError } from "@src/utils/helpers/http-error.helper";
import { ApiResult } from "@src/utils/types/api-result.type";
import { createHmac } from "node:crypto";

@Injectable()
export class VeriffKycService {
  private readonly logger = new Logger(VeriffKycService.name);

  public constructor(
    private readonly envService: EnvService,
    private readonly egressService: EgressService,
  ) {}

  private async createHeaders(sessionId?: string): Promise<Record<string, string>> {
    const secretKey = this.envService.VERIFF_SECRET_KEY;
    const apiKey = this.envService.VERIFF_API_KEY;

    const headers = {
      "X-AUTH-CLIENT": `${apiKey}`,
      ...(sessionId && { "X-HMAC-SIGNATURE": createHmac("sha256", secretKey).update(sessionId).digest("hex") }),
    };

    return headers;
  }

  /**
   * Create a session.
   *
   * @returns Object {@link VeriffSessionType}
   * @description Docs:
   *
   *  - Technical: https://devdocs.veriff.com/apidocs/v1sessions
   *  - Technical: https://devdocs.veriff.com/v1/docs/verification-session-decision-codes-table
   *  - Technical: https://devdocs.veriff.com/v1/docs/granular-reason-codes
   */
  public async createSession(input: VeriffCreateSessionInput): Promise<ApiResult<VeriffCreateSessionOutput>> {
    try {
      const gender = VeriffKycDomainPersonGenderToVeriffGenderMapper.parse(input.profile.gender);
      const documentType = VeriffKycDomainDocumentTypeToVeriffDocumentTypeMapper.parse(
        input.document.identificationType,
      );

      const body = {
        verification: {
          person: {
            firstName: input.profile.firstName,
            lastName: input.profile.lastName,
            idNumber: input.document.identificationNumber,
            phoneNumber: input.contact.phone,
            gender: gender,
            dateOfBirth: input.profile.dateOfBirth,
            email: input.contact.email,
            maritalStatus: input.profile.maritalStatus,
            occupation: input.profile.occupation,
          },
          document: {
            number: input.document.identificationNumber,
            country: "BR",
            type: documentType,
            firstIssue: input.document.identificationDateOfIssue,
          },
          address: {
            fullAddress: input.address,
          },
          vendorData: input.userId.value,
          callback: input.callbackUrl,
        },
      };

      const headers = await this.createHeaders();
      const response = await this.egressService.post("/v1/sessions", body, { headers: headers });

      const result = {
        data: {
          id: response.verification.id,
          url: response.verification.url,
          reference: response.verification.vendorData,
        },
      };

      return result;
    } catch (error) {
      this.logger.error(error.message, error.stack);
      return handleHttpError(error);
    }
  }
}
