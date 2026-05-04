import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { DatabaseModule } from "@src/infra/database/database.module";
import { IngressModule } from "@src/infra/logging/ingress/ingress.module";
import { HookInternalController } from "@src/modules/hook/api/internal/hook-internal.controller";
import { HookInternalProcessVeriffHandler } from "@src/modules/hook/application/internal/handlers/hook-internal-process-veriff.handler";

@Module({
  imports: [DatabaseModule, CqrsModule, IngressModule],
  controllers: [HookInternalController],
  providers: [HookInternalProcessVeriffHandler],
})
export class HookModule {}
