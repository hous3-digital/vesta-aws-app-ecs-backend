import { ArgumentsHost, HttpStatus } from "@nestjs/common";
import { DomainErrorFilter } from "@src/infra/http/domain-error.filter";
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  InvalidStateError,
  NotFoundError,
  ValidationError,
} from "@src/shared/errors";

class UnmappedError extends DomainError {}

const makeSut = () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json: json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status: status }) }),
  } as unknown as ArgumentsHost;
  const sut = new DomainErrorFilter();
  return { sut, host, status, json };
};

describe("DomainErrorFilter", () => {
  it.each([
    [new NotFoundError("CREDENTIAL_NOT_FOUND", "Credential not found"), HttpStatus.NOT_FOUND],
    [new ConflictError("CREDENTIAL_ALREADY_ISSUED", "Credential already issued"), HttpStatus.CONFLICT],
    [new InvalidStateError("CREDENTIAL_NOT_PENDING", "Only pending credentials"), HttpStatus.UNPROCESSABLE_ENTITY],
    [new ForbiddenError("ISSUER_MISMATCH", "Resource belongs to another issuer"), HttpStatus.FORBIDDEN],
    [new ValidationError("EXPIRATION_TOO_LONG", "Expiration above the limit"), HttpStatus.BAD_REQUEST],
    [new UnmappedError("UNMAPPED", "No mapping"), HttpStatus.INTERNAL_SERVER_ERROR],
  ])("maps %p to its HTTP status", (error, expectedStatus) => {
    // Arrange
    const { sut, host, status } = makeSut();

    // Act
    sut.catch(error, host);

    // Assert
    expect(status).toHaveBeenCalledWith(expectedStatus);
  });

  it("returns the Nest body shape plus the stable code and hides details", () => {
    // Arrange
    const { sut, host, json } = makeSut();
    const error = new NotFoundError("CREDENTIAL_NOT_FOUND", "Credential not found", { credentialId: "cred_1" });

    // Act
    sut.catch(error, host);

    // Assert
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.NOT_FOUND,
      code: "CREDENTIAL_NOT_FOUND",
      message: "Credential not found",
      error: "NotFoundError",
    });
  });
});
