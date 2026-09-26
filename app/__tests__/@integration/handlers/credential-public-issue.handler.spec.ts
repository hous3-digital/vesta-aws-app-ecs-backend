import { ConflictException, UnprocessableEntityException } from "@nestjs/common";
import { CredentialPublicIssueCommand } from "@src/modules/credential/application/public/commands/credential-public-issue.command";
import { CredentialPublicIssueHandler } from "@src/modules/credential/application/public/handlers/credential-public-issue.handler";
import { CredentialStatus } from "@src/modules/credential/domain/credential.entity";
import type { EnvService } from "@src/infra/env/env.service";
import type { VcService } from "@src/modules/vc/vc.service";
import type { WalletService } from "@src/modules/wallet/wallet.service";
import { Id } from "@src/shared/value-objects/id.value-object";
import { FIXTURE_ISSUER_EXTERNAL_ID } from "@test/constants";
import { generateCpf } from "@test/helpers/generate-cpf.helper";
import { credentialModel } from "@test/mocks/model/credential.model";
import { issuerModel } from "@test/mocks/model/issuer.model";
import { mockCredentialRepository } from "@test/mocks/repository/credential.repository.mock";
import { mockIssuerRepository } from "@test/mocks/repository/issuer.repository.mock";
import { mockEnvService } from "@test/mocks/service/env.service.mock";
import { mockVcService } from "@test/mocks/service/vc.service.mock";
import { mockWalletService } from "@test/mocks/service/wallet.service.mock";

// VcService, EnvService and WalletService are injected as concrete classes (flat modules, TD-002),
// so their doubles are cast at the constructor until they sit behind a port.
const makeSut = () => {
  const credentialRepository = mockCredentialRepository();
  const issuerRepository = mockIssuerRepository();
  const vcService = mockVcService();
  const envService = mockEnvService();
  const walletService = mockWalletService();
  issuerRepository.findByExternalId.mockResolvedValue(issuerModel());
  const sut = new CredentialPublicIssueHandler(
    credentialRepository,
    vcService as unknown as VcService,
    envService as unknown as EnvService,
    walletService as unknown as WalletService,
    issuerRepository,
  );
  return { sut, credentialRepository, issuerRepository, vcService, envService, walletService };
};

const issueCommand = (issuerId: string = FIXTURE_ISSUER_EXTERNAL_ID): CredentialPublicIssueCommand =>
  new CredentialPublicIssueCommand(
    issuerId,
    generateCpf(),
    "Test Subject",
    "1990-01-01",
    "complete",
    "document",
    "BR",
    365,
  );

describe("CredentialPublicIssueHandler", () => {
  it("CT-VESTA-CRED-003 rejects issuing when the CPF already has a non-rejected credential", async () => {
    // Arrange
    const { sut, credentialRepository } = makeSut();
    credentialRepository.findByCpfDedupKey.mockResolvedValue(credentialModel({ status: CredentialStatus.Active }));

    // Act
    const act = sut.execute(issueCommand());

    // Assert
    await expect(act).rejects.toThrow(ConflictException);
    await expect(act).rejects.toMatchObject({ response: { error: "CPF_ALREADY_REGISTERED" } });
    expect(credentialRepository.saveOrThrow).not.toHaveBeenCalled();
  });

  it("CT-VESTA-CRED-003 rejects issuing when the CPF has a PENDING credential", async () => {
    // Arrange
    const { sut, credentialRepository } = makeSut();
    credentialRepository.findByCpfDedupKey.mockResolvedValue(credentialModel({ status: CredentialStatus.Pending }));

    // Act
    const act = sut.execute(issueCommand());

    // Assert
    await expect(act).rejects.toMatchObject({ response: { error: "CPF_ALREADY_REGISTERED" } });
  });

  it("CT-VESTA-CRED-004 deletes a REJECTED credential of the CPF and issues a new one", async () => {
    // Arrange
    const { sut, credentialRepository } = makeSut();
    const rejectedId = Id.restore("credential_rejected");
    credentialRepository.findByCpfDedupKey.mockResolvedValue(
      credentialModel({ id: rejectedId, status: CredentialStatus.Rejected }),
    );

    // Act
    const result = await sut.execute(issueCommand());

    // Assert
    expect(credentialRepository.deleteById).toHaveBeenCalledWith(rejectedId);
    expect(credentialRepository.saveOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ status: CredentialStatus.Active, issuerId: FIXTURE_ISSUER_EXTERNAL_ID }),
    );
    expect(result).toMatchObject({ status: CredentialStatus.Active, alreadyExisted: false });
    expect(result.credentialId).not.toBe(rejectedId.value);
  });

  it("CT-VESTA-CRED-006 refuses with 422 ISSUER_NOT_REGISTERED when the issuer does not exist", async () => {
    // Arrange
    const { sut, issuerRepository, credentialRepository } = makeSut();
    issuerRepository.findByExternalId.mockResolvedValue(null);

    // Act
    const act = sut.execute(issueCommand("unknown_bank"));

    // Assert
    await expect(act).rejects.toThrow(UnprocessableEntityException);
    await expect(act).rejects.toMatchObject({ response: { error: "ISSUER_NOT_REGISTERED" } });
    expect(credentialRepository.saveOrThrow).not.toHaveBeenCalled();
  });

  it("CT-VESTA-CRED-006 refuses with 422 ISSUER_INACTIVE when the issuer is not active", async () => {
    // Arrange
    const { sut, issuerRepository, credentialRepository } = makeSut();
    issuerRepository.findByExternalId.mockResolvedValue(issuerModel({ status: "inactive" }));

    // Act
    const act = sut.execute(issueCommand());

    // Assert
    await expect(act).rejects.toThrow(UnprocessableEntityException);
    await expect(act).rejects.toMatchObject({ response: { error: "ISSUER_INACTIVE" } });
    expect(credentialRepository.saveOrThrow).not.toHaveBeenCalled();
  });
});
