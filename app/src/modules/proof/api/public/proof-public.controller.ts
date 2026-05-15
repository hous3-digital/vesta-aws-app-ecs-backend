import { Body, Controller, Post } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ProofPublicGenerateAndSubmitCommand } from "@src/modules/proof/application/public/commands/proof-public-generate-and-submit.command";
import { ProofPublicSubmitCommand } from "@src/modules/proof/application/public/commands/proof-public-submit.command";
import { ProofPublicGenerateAndSubmitInput } from "@src/modules/proof/api/public/inputs/proof-public-generate-and-submit.input";
import { ProofPublicSubmitInput } from "@src/modules/proof/api/public/inputs/proof-public-submit.input";
import type { VestaVC } from "@src/shared/types/vesta-vc.types";

@ApiTags("proof")
@Controller("/public/proof")
export class ProofPublicController {
  public constructor(private readonly commandBus: CommandBus) {}

  @ApiOperation({ summary: "Generate ZK proof from VC and submit to Soroban for on-chain verification" })
  @Post("/generate-and-submit")
  public async generateAndSubmit(@Body() input: ProofPublicGenerateAndSubmitInput) {
    const command = new ProofPublicGenerateAndSubmitCommand(
      input.vc as unknown as VestaVC,
      input.privateInputs,
      input.verifierId,
      input.minKycLevel,
      input.challenge,
    );
    return this.commandBus.execute(command);
  }

  @ApiOperation({ summary: "Submit a pre-generated ZK proof to Soroban" })
  @Post("/submit")
  public async submit(@Body() input: ProofPublicSubmitInput) {
    const proof = { ...input.proof, protocol: input.proof.protocol ?? "groth16", curve: input.proof.curve ?? "bn128" };
    const command = new ProofPublicSubmitCommand(input.vcHash, proof, input.publicSignals, input.verifierId);
    return this.commandBus.execute(command);
  }
}
