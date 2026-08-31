import { BadRequestException, Body, Controller, Get, Post } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { BackofficeAuth } from "@src/infra/auth/backoffice-auth.guard";
import { PublicEndpoint } from "@src/infra/auth/public.decorator";
import { type BackofficeProfileResult } from "@src/modules/backoffice/profile/application/handlers/backoffice-profile.handler";
import { BackofficeProfileQuery } from "@src/modules/backoffice/profile/application/queries/backoffice-profile.query";
import { CurrentIssuer } from "@src/modules/backoffice/shared/current-issuer.decorator";
import { WalletService } from "@src/modules/wallet/wallet.service";
import { ChallengeService } from "@src/modules/challenge/challenge.service";
import { CurrentBackofficeUser } from "@src/modules/backoffice/shared/current-backoffice-user.decorator";
import type { BackofficeSession } from "@src/infra/auth/auth.types";
import {
  ConfirmWalletControlInput,
  SubmitWalletTrustlineInput,
} from "@src/modules/backoffice/profile/api/inputs/wallet-activation.input";

@ApiTags("backoffice/profile")
@PublicEndpoint()
@BackofficeAuth()
@Controller("/backoffice/profile")
export class BackofficeProfileController {
  public constructor(
    private readonly queryBus: QueryBus,
    private readonly walletService: WalletService,
    private readonly challengeService: ChallengeService,
  ) {}

  @ApiOperation({ summary: "Perfil do issuer atual no backoffice" })
  @Get()
  public async getProfile(@CurrentIssuer() issuerId: string): Promise<BackofficeProfileResult> {
    return this.queryBus.execute<BackofficeProfileQuery, BackofficeProfileResult>(new BackofficeProfileQuery(issuerId));
  }

  @ApiOperation({ summary: "Status público da wallet Stellar organizacional do issuer atual" })
  @Get("/wallet")
  public async getOrganizationWallet(@CurrentIssuer() issuerId: string) {
    return this.walletService.getOrganizationWallet(issuerId);
  }

  @ApiOperation({ summary: "Inicia a confirmação de controle da wallet organizacional" })
  @Post("/wallet/activation/start")
  public async startWalletActivation(@CurrentBackofficeUser() user: BackofficeSession) {
    let wallet = await this.walletService.getOrganizationWallet(user.issuerId);
    if (!wallet?.accountActivated) {
      wallet = await this.walletService.provisionForOrganization(user.issuerId);
    }
    if (!wallet.address) throw new BadRequestException("Carteira organizacional sem endereço Stellar");
    const auth = await this.walletService.issueOrganizationAuthToken(user.issuerId);
    const challenge = await this.challengeService.generate({
      kind: "organization-wallet-control",
      issuerId: user.issuerId,
      userId: user.userId,
      walletAddress: wallet.address,
    });
    return {
      privyAppId: this.walletService.getPrivyAppId(),
      customAuthToken: auth.token,
      customAuthExpiresAt: new Date(auth.expiresAt).toISOString(),
      challenge: challenge.challenge,
      challengeHash: `0x${challenge.challenge}`,
      challengeExpiresAt: new Date(challenge.expiresAt).toISOString(),
      wallet,
    };
  }

  @ApiOperation({ summary: "Confirma que a wallet Privy do issuer assinou o desafio" })
  @Post("/wallet/activation/confirm")
  public async confirmWalletActivation(
    @CurrentBackofficeUser() user: BackofficeSession,
    @Body() input: ConfirmWalletControlInput,
  ) {
    const context = await this.challengeService.consumeContext(input.challenge);
    if (
      context?.kind !== "organization-wallet-control" ||
      context.issuerId !== user.issuerId ||
      context.userId !== user.userId
    ) {
      throw new BadRequestException("Desafio inválido, expirado ou já utilizado");
    }
    return this.walletService.confirmOrganizationWalletControl({
      issuerId: user.issuerId,
      userId: user.userId,
      walletAddress: context.walletAddress,
      challenge: input.challenge,
      signature: input.signature,
    });
  }

  @ApiOperation({ summary: "Prepara a transação Stellar exata para criar a trustline" })
  @Post("/wallet/trustline/prepare")
  public async prepareWalletTrustline(@CurrentIssuer() issuerId: string) {
    return this.walletService.prepareOrganizationTrustline(issuerId);
  }

  @ApiOperation({ summary: "Submete a trustline assinada pela wallet organizacional" })
  @Post("/wallet/trustline/submit")
  public async submitWalletTrustline(@CurrentIssuer() issuerId: string, @Body() input: SubmitWalletTrustlineInput) {
    return this.walletService.submitOrganizationTrustline({ issuerId, ...input });
  }
}
