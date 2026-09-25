import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { CredentialPublicKycStatusCommand } from "@src/modules/credential/application/public/commands/credential-public-kyc-status.command";
import { CredentialPublicKycStatusHandler } from "@src/modules/credential/application/public/handlers/credential-public-kyc-status.handler";
import { CredentialStatus } from "@src/modules/credential/domain/credential.entity";
import type { EnvService } from "@src/infra/env/env.service";
import { FIXTURE_ISSUER_EXTERNAL_ID } from "@test/constants";
import { generateCpf } from "@test/helpers/generate-cpf.helper";
import { credentialModel } from "@test/mocks/model/credential.model";
import { mockCredentialRepository } from "@test/mocks/repository/credential.repository.mock";
import { mockEnvService } from "@test/mocks/service/env.service.mock";

// EnvService is injected as a concrete class; its double is cast at the constructor.
const makeSut = () => {
  const credentialRepository = mockCredentialRepository();
  const envService = mockEnvService();
  const sut = new CredentialPublicKycStatusHandler(credentialRepository, envService as unknown as EnvService);
  return { sut, credentialRepository, envService };
};

const kycStatusCommand = (
  status: "approved" | "rejected",
  issuerId: string = FIXTURE_ISSUER_EXTERNAL_ID,
): CredentialPublicKycStatusCommand =>
  new CredentialPublicKycStatusCommand(issuerId, generateCpf(), status, "complete");

describe("CredentialPublicKycStatusHandler", () => {
  it("CT-VESTA-KYC-003 refuses a webhook from an issuer that does not own the credential", async () => {
    // Arrange
    const { sut, credentialRepository } = makeSut();
    credentialRepository.findByCpfDedupKey.mockResolvedValue(
      credentialModel({ issuerId: "other_bank", status: CredentialStatus.Pending }),
    );

    // Act
    const act = sut.execute(kycStatusCommand("approved"));

    // Assert
    await expect(act).rejects.toThrow(ForbiddenException);
    await expect(act).rejects.toMatchObject({ response: { error: "CREDENTIAL_ISSUER_MISMATCH" } });
    expect(credentialRepository.updateOrThrow).not.toHaveBeenCalled();
  });

  it("CT-VESTA-KYC-004 returns 404 CREDENTIAL_NOT_FOUND when no credential exists for the CPF", async () => {
    // Arrange
    const { sut, credentialRepository } = makeSut();
    credentialRepository.findByCpfDedupKey.mockResolvedValue(null);

    // Act
    const act = sut.execute(kycStatusCommand("approved"));

    // Assert
    await expect(act).rejects.toThrow(NotFoundException);
    await expect(act).rejects.toMatchObject({ response: { error: "CREDENTIAL_NOT_FOUND" } });
  });

  it("CT-VESTA-KYC-004 returns 409 CREDENTIAL_NOT_PENDING when rejecting a credential already ACTIVE", async () => {
    // Arrange
    const { sut, credentialRepository } = makeSut();
    credentialRepository.findByCpfDedupKey.mockResolvedValue(credentialModel({ status: CredentialStatus.Active }));

    // Act
    const act = sut.execute(kycStatusCommand("rejected"));

    // Assert
    await expect(act).rejects.toThrow(ConflictException);
    await expect(act).rejects.toMatchObject({ response: { error: "CREDENTIAL_NOT_PENDING" } });
    expect(credentialRepository.updateOrThrow).not.toHaveBeenCalled();
  });

  it("CT-VESTA-KYC-004 approving a credential already ACTIVE is a no-op with updated false", async () => {
    // Arrange
    const { sut, credentialRepository } = makeSut();
    credentialRepository.findByCpfDedupKey.mockResolvedValue(credentialModel({ status: CredentialStatus.Active }));

    // Act
    const result = await sut.execute(kycStatusCommand("approved"));

    // Assert
    expect(result).toMatchObject({ updated: false, status: CredentialStatus.Active });
    expect(credentialRepository.updateOrThrow).not.toHaveBeenCalled();
  });
});
