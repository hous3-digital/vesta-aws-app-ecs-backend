import { Logger } from "@nestjs/common";
import { CommandHandler, EventBus, ICommandHandler } from "@nestjs/cqrs";
import { IngressLogger, IngressRequest, IngressResponse } from "@src/infra/logging/ingress/infra/ingress.logger";
import { HookInternalProcessVeriffCommand } from "@src/modules/hook/application/internal/commands/hook-internal-process-veriff.command";
import { ExternalVeriffKycReceivedEvent } from "@src/shared/events/external/external-veriff-kyc-received.event";

@CommandHandler(HookInternalProcessVeriffCommand)
export class HookInternalProcessVeriffHandler implements ICommandHandler<HookInternalProcessVeriffCommand> {
  private readonly logger = new Logger(HookInternalProcessVeriffHandler.name);

  public constructor(
    private readonly ingressLogger: IngressLogger,
    private readonly eventBus: EventBus,
  ) {}

  public async execute(command: HookInternalProcessVeriffCommand): Promise<void> {
    const { method, protocol, host, path, body, ip, statusCode } = command;

    try {
      const ingressRequest: IngressRequest = {
        ip: ip,
        method: method,
        protocol: protocol,
        host: host,
        path: path,
        body: body,
      };

      const ingressResponse: IngressResponse = {
        status: statusCode,
      };

      await this.ingressLogger.log(ingressRequest, ingressResponse);

      this.eventBus.publish(new ExternalVeriffKycReceivedEvent(body));
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw error;
    }
  }
}
