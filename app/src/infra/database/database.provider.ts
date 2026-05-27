import { PrismaService } from "@src/infra/database/@prisma/prisma.service";
import { ICredentialRepository } from "@src/modules/credential/domain/credential.repository";
import { CredentialDataAccessObject } from "@src/modules/credential/infra/credential.data-access-object";
import { CredentialRepository } from "@src/modules/credential/infra/credential.repository";
import { IAttestationRepository } from "@src/modules/proof/domain/attestation.repository";
import { AttestationRepository } from "@src/modules/proof/infra/attestation.repository";

// prettier-ignore
const DatabaseProvider = {
  // Services
  PrismaService,

  // Repositories
  CredentialRepository: { useClass: CredentialRepository, provide: ICredentialRepository },
  AttestationRepository: { useClass: AttestationRepository, provide: IAttestationRepository },

  // Data Access Objects
  CredentialDataAccessObject,
};

const DatabaseProviders = Object.values(DatabaseProvider);

export { DatabaseProvider, DatabaseProviders };
