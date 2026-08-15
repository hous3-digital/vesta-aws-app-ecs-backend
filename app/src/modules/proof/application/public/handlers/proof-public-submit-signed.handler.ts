import { BadRequestException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { Attestation } from "@src/modules/proof/domain/attestation.entity";
import { IAttestationRepository } from "@src/modules/proof/domain/attestation.repository";
import { ProofPublicSubmitSignedCommand } from "@src/modules/proof/application/public/commands/proof-public-submit-signed.command";
import { PrepareSessionService } from "@src/modules/proof/application/services/prepare-session.service";
import { StellarService } from "@src/modules/stellar/stellar.service";
import { WalletService } from "@src/modules/wallet/wallet.service";

export interface ProofPublicSubmitSignedResult {
  verified: boolean;
  zkProof: {
    protocol: string;
    curve: string;
    publicSignals: string[];
    proofHash: string;
    mock: boolean;
  };
  stellar: {
    txHash: string;
    ledger: number;
    contractId: string;
    network: string;
    mock: boolean;
  };
  attestation: {
    id: string;
    vcHash: string;
    verifierId: string;
    kycLevel: string;
    userWalletAddress: string | null;
    createdAt: string;
  };
}

@Injectable()
@CommandHandler(ProofPublicSubmitSignedCommand)
export class ProofPublicSubmitSignedHandler
  implements ICommandHandler<ProofPublicSubmitSignedCommand, ProofPublicSubmitSignedResult>
{
  private readonly logger = new Logger(ProofPublicSubmitSignedHandler.name);

  public constructor(
    private readonly attestationRepository: IAttestationRepository,
    private readonly stellarService: StellarService,
    private readonly walletService: WalletService,
    private readonly prepareSessionService: PrepareSessionService,
  ) {}

  public async execute(command: ProofPublicSubmitSignedCommand): Promise<ProofPublicSubmitSignedResult> {
    const session = await this.prepareSessionService.consume(command.prepareSessionId);
    if (!session) {
      throw new BadRequestException(
        "prepareSessionId inválido, expirado ou já consumido. Reinicie o fluxo via /public/proof/prepare.",
      );
    }

    const requiresUserSignature = !session.sourceAccountSignedByBackend;

    if (requiresUserSignature) {
      if (!command.privyIdentityToken) {
        throw new UnauthorizedException(
          "privyIdentityToken é obrigatório quando a sessão prepare requer assinatura do usuário.",
        );
      }
      const claims = await this.walletService.verifyIdentityToken(command.privyIdentityToken);
      if (claims.walletAddress !== session.expectedSource) {
        this.logger.error(
          `Wallet address mismatch — token=${claims.walletAddress.slice(0, 8)}..., expected=${session.expectedSource.slice(0, 8)}...`,
        );
        throw new UnauthorizedException("Wallet do identity token diferente da esperada para esta sessão.");
      }
    }

    this.logger.log(`Submetendo tx via fee-bump — sessionMock: ${session.mock}`);
    const stellarResult = await this.stellarService.submitWithFeeBump(command.signedTxXdr);

    const attestation = Attestation.create({
      vcHash: session.vcHash,
      proofHash: session.proofHash,
      verifierId: session.verifierId,
      kycLevel: session.kycLevel,
      sorobanTxHash: stellarResult.txHash,
      sorobanLedger: stellarResult.ledger,
      onChainResult: stellarResult.onChainResult,
      issuerId: session.issuerId,
      userWalletAddress: session.userWalletAddress,
    });

    await this.attestationRepository.saveOrThrow(attestation);

    return {
      verified: stellarResult.onChainResult,
      zkProof: {
        protocol: session.zkProof.protocol,
        curve: session.zkProof.curve,
        publicSignals: session.zkProof.publicSignals,
        proofHash: session.proofHash,
        mock: session.mock,
      },
      stellar: {
        txHash: stellarResult.txHash,
        ledger: stellarResult.ledger,
        contractId: this.stellarService.getContractId(),
        network: "stellar:soroban",
        mock: stellarResult.mock,
      },
      attestation: {
        id: attestation.id.value,
        vcHash: session.vcHash,
        verifierId: session.verifierId,
        kycLevel: session.kycLevel,
        userWalletAddress: session.userWalletAddress,
        createdAt: attestation.createdAt.toISOString(),
      },
    };
  }
}
