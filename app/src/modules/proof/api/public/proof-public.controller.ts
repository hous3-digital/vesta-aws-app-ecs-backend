import { Body, Controller, Post } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { ProofPublicPrepareCommand } from "@src/modules/proof/application/public/commands/proof-public-prepare.command";
import { ProofPublicSubmitCommand } from "@src/modules/proof/application/public/commands/proof-public-submit.command";
import { ProofPublicSubmitSignedCommand } from "@src/modules/proof/application/public/commands/proof-public-submit-signed.command";
import { ProofPublicPrepareInput } from "@src/modules/proof/api/public/inputs/proof-public-prepare.input";
import { ProofPublicSubmitInput } from "@src/modules/proof/api/public/inputs/proof-public-submit.input";
import { ProofPublicSubmitSignedInput } from "@src/modules/proof/api/public/inputs/proof-public-submit-signed.input";
import type { VestaVC } from "@src/shared/types/vesta-vc.types";

@ApiTags("proof")
@Controller("/public/proof")
export class ProofPublicController {
  public constructor(private readonly commandBus: CommandBus) {}

  @ApiOperation({
    summary:
      "Phase 1 — Generate ZK proof and build the unsigned Soroban transaction. The SDK must sign and submit via /submit-signed.",
  })
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post("/prepare")
  public async prepare(@Body() input: ProofPublicPrepareInput) {
    const command = new ProofPublicPrepareCommand(
      input.vc as unknown as VestaVC,
      input.privateInputs,
      input.verifierId,
      input.minKycLevel,
      input.challenge,
    );
    return this.commandBus.execute(command);
  }

  @ApiOperation({
    summary:
      "Phase 2 — Submit the signed transaction. Backend wraps it in a fee-bump (Vesta sponsors fees) and forwards to Soroban.",
  })
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post("/submit-signed")
  public async submitSigned(@Body() input: ProofPublicSubmitSignedInput) {
    const command = new ProofPublicSubmitSignedCommand(
      input.prepareSessionId,
      input.signedTxXdr,
      input.privyIdentityToken ?? null,
    );
    return this.commandBus.execute(command);
  }

  @ApiOperation({ summary: "Submit a pre-generated ZK proof to Soroban (legacy / external proof flow)" })
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post("/submit")
  public async submit(@Body() input: ProofPublicSubmitInput) {
    const proof = { ...input.proof, protocol: input.proof.protocol ?? "groth16", curve: input.proof.curve ?? "bn128" };
    const command = new ProofPublicSubmitCommand(input.vcHash, proof, input.publicSignals, input.verifierId);
    return this.commandBus.execute(command);
  }
}
