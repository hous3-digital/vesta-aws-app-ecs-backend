import { Body, Controller, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AdminSecret } from "@src/infra/auth/admin-secret.guard";
import { PublicEndpoint } from "@src/infra/auth/public.decorator";
import { CommissionLedgerService } from "@src/modules/commission/commission-ledger.service";

@ApiTags("admin/payout-cycles")
@Controller("/admin/payout-cycles")
@PublicEndpoint()
@AdminSecret()
export class PayoutPreviewController {
  public constructor(private readonly ledger: CommissionLedgerService) {}

  @ApiOperation({ summary: "Cria uma prévia idempotente do fechamento de repasses" })
  @Post("/preview")
  public preview(@Body() body: { periodStart: string; periodEnd: string; cutoffAt: string }) {
    return this.ledger.createPreview({
      periodStart: new Date(body.periodStart),
      periodEnd: new Date(body.periodEnd),
      cutoffAt: new Date(body.cutoffAt),
    });
  }
}
