import { Injectable, NotFoundException } from "@nestjs/common";
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { VerifierUpdateStatusCommand } from "@src/modules/backoffice/verifiers/application/commands/verifier-update-status.command";
import { VerifierStatus } from "@src/modules/backoffice/verifiers/domain/verifier.entity";
import { IVerifierRepository } from "@src/modules/backoffice/verifiers/domain/verifier.repository";

export interface VerifierUpdateStatusResult {
  id: string;
  status: string;
  updatedAt: string;
}

@Injectable()
@CommandHandler(VerifierUpdateStatusCommand)
export class VerifierUpdateStatusHandler
  implements ICommandHandler<VerifierUpdateStatusCommand, VerifierUpdateStatusResult>
{
  public constructor(private readonly verifierRepository: IVerifierRepository) {}

  public async execute(command: VerifierUpdateStatusCommand): Promise<VerifierUpdateStatusResult> {
    const verifier = await this.verifierRepository.findById(command.id);
    if (!verifier) throw new NotFoundException(`Verifier nao encontrado: ${command.id}`);

    if (command.status === VerifierStatus.Revoked) {
      verifier.revoke();
    } else if (command.status === VerifierStatus.Active) {
      verifier.reactivate();
    }

    await this.verifierRepository.updateOrThrow(verifier);
    return { id: verifier.id, status: verifier.status, updatedAt: verifier.updatedAt.toISOString() };
  }
}
