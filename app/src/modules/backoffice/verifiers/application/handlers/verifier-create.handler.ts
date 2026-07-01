import { Injectable } from "@nestjs/common";
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { VerifierCreateCommand } from "@src/modules/backoffice/verifiers/application/commands/verifier-create.command";
import { Verifier } from "@src/modules/backoffice/verifiers/domain/verifier.entity";
import { IVerifierRepository } from "@src/modules/backoffice/verifiers/domain/verifier.repository";

export interface VerifierCreateResult {
  id: string;
  name: string;
  status: string;
  createdAt: string;
}

@Injectable()
@CommandHandler(VerifierCreateCommand)
export class VerifierCreateHandler implements ICommandHandler<VerifierCreateCommand, VerifierCreateResult> {
  public constructor(private readonly verifierRepository: IVerifierRepository) {}

  public async execute(command: VerifierCreateCommand): Promise<VerifierCreateResult> {
    const verifier = Verifier.create({ id: command.id, name: command.name });
    await this.verifierRepository.saveOrThrow(verifier);
    return {
      id: verifier.id,
      name: verifier.name,
      status: verifier.status,
      createdAt: verifier.createdAt.toISOString(),
    };
  }
}
