import { Controller, Get, Param, Query, Res } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { BackofficeAuth } from "@src/infra/auth/backoffice-auth.guard";
import { PublicEndpoint } from "@src/infra/auth/public.decorator";
import { type VerificationDetailResult } from "@src/modules/backoffice/verifications/application/handlers/verification-detail.handler";
import { type VerificationListResult } from "@src/modules/backoffice/verifications/application/handlers/verification-list.handler";
import { VerificationDetailQuery } from "@src/modules/backoffice/verifications/application/queries/verification-detail.query";
import { VerificationExportQuery } from "@src/modules/backoffice/verifications/application/queries/verification-export.query";
import { VerificationListQuery } from "@src/modules/backoffice/verifications/application/queries/verification-list.query";
import { VerificationExportInput } from "@src/modules/backoffice/verifications/api/inputs/verification-export.input";
import { VerificationListInput } from "@src/modules/backoffice/verifications/api/inputs/verification-list.input";
import { type VerificationExportResult } from "@src/modules/backoffice/verifications/application/handlers/verification-export.handler";
import { CurrentIssuer } from "@src/modules/backoffice/shared/current-issuer.decorator";

@ApiTags("backoffice/verifications")
@PublicEndpoint()
@BackofficeAuth()
@Controller("/backoffice/verifications")
export class VerificationsBackofficeController {
  public constructor(private readonly queryBus: QueryBus) {}

  @ApiOperation({ summary: "Lista verificacoes (attestations) do issuer" })
  @Get("/")
  public async list(
    @CurrentIssuer() issuerId: string,
    @Query() input: VerificationListInput,
  ): Promise<VerificationListResult> {
    const query = new VerificationListQuery(
      issuerId,
      input.verifierId,
      input.status,
      input.from,
      input.to,
      input.limit ?? 20,
      input.cursor,
    );
    return this.queryBus.execute<VerificationListQuery, VerificationListResult>(query);
  }

  @ApiOperation({ summary: "Export CSV das verificacoes no periodo" })
  @Get("/export")
  public async export(
    @CurrentIssuer() issuerId: string,
    @Query() input: VerificationExportInput,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.queryBus.execute<VerificationExportQuery, VerificationExportResult>(
      new VerificationExportQuery(issuerId, input.period, input.from, input.to),
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    res.send(result.csv);
  }

  @ApiOperation({ summary: "Detalhe de uma verificacao" })
  @Get("/:id")
  public async detail(
    @CurrentIssuer() issuerId: string,
    @Param("id") id: string,
  ): Promise<VerificationDetailResult> {
    return this.queryBus.execute<VerificationDetailQuery, VerificationDetailResult>(
      new VerificationDetailQuery(issuerId, id),
    );
  }
}
