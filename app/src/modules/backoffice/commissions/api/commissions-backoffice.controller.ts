import { Controller, Get, Query } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PublicEndpoint } from "@src/infra/auth/public.decorator";
import { type CommissionKpisResult } from "@src/modules/backoffice/commissions/application/handlers/commission-kpis.handler";
import { type CommissionPendingResult } from "@src/modules/backoffice/commissions/application/handlers/commission-pending.handler";
import { type CommissionSummaryResult } from "@src/modules/backoffice/commissions/application/handlers/commission-summary.handler";
import { type CommissionTimeseriesResult } from "@src/modules/backoffice/commissions/application/handlers/commission-timeseries.handler";
import { CommissionKpisQuery } from "@src/modules/backoffice/commissions/application/queries/commission-kpis.query";
import { CommissionPendingQuery } from "@src/modules/backoffice/commissions/application/queries/commission-pending.query";
import { CommissionSummaryQuery } from "@src/modules/backoffice/commissions/application/queries/commission-summary.query";
import { CommissionTimeseriesQuery } from "@src/modules/backoffice/commissions/application/queries/commission-timeseries.query";
import {
  CommissionPeriodInput,
  CommissionTimeseriesInput,
} from "@src/modules/backoffice/commissions/api/inputs/commission-period.input";
import { CurrentIssuer } from "@src/modules/backoffice/shared/current-issuer.decorator";

@ApiTags("backoffice/commissions")
@PublicEndpoint()
@Controller("/backoffice/commissions")
export class CommissionsBackofficeController {
  public constructor(private readonly queryBus: QueryBus) {}

  @ApiOperation({ summary: "Total da comissao no periodo + delta vs anterior" })
  @Get("/summary")
  public async summary(
    @CurrentIssuer() issuerId: string,
    @Query() input: CommissionPeriodInput,
  ): Promise<CommissionSummaryResult> {
    return this.queryBus.execute<CommissionSummaryQuery, CommissionSummaryResult>(
      new CommissionSummaryQuery(issuerId, input.period, input.from, input.to),
    );
  }

  @ApiOperation({ summary: "Serie temporal (dia) de reutilizacoes e comissao" })
  @Get("/timeseries")
  public async timeseries(
    @CurrentIssuer() issuerId: string,
    @Query() input: CommissionTimeseriesInput,
  ): Promise<CommissionTimeseriesResult> {
    return this.queryBus.execute<CommissionTimeseriesQuery, CommissionTimeseriesResult>(
      new CommissionTimeseriesQuery(issuerId, input.period, input.from, input.to, input.granularity ?? "day"),
    );
  }

  @ApiOperation({ summary: "KPIs: reutilizacoes, credenciais ativas, por reutilizacao" })
  @Get("/kpis")
  public async kpis(
    @CurrentIssuer() issuerId: string,
    @Query() input: CommissionPeriodInput,
  ): Promise<CommissionKpisResult> {
    return this.queryBus.execute<CommissionKpisQuery, CommissionKpisResult>(
      new CommissionKpisQuery(issuerId, input.period, input.from, input.to),
    );
  }

  @ApiOperation({ summary: "Repasse pendente (calculado em tempo real, sem persistencia)" })
  @Get("/pending")
  public async pending(@CurrentIssuer() issuerId: string): Promise<CommissionPendingResult> {
    return this.queryBus.execute<CommissionPendingQuery, CommissionPendingResult>(
      new CommissionPendingQuery(issuerId),
    );
  }
}
