import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { UnhandledExceptionBus } from "@nestjs/cqrs";
import { SpanStatusCode, trace } from "@opentelemetry/api";

@Injectable()
export class GlobalUnhandledException implements OnModuleInit {
  private readonly logger = new Logger(GlobalUnhandledException.name);

  public constructor(private readonly unhandledExceptionBus: UnhandledExceptionBus) {}

  onModuleInit() {
    this.unhandledExceptionBus.subscribe((exceptionInfo) => {
      this.handleUnhandledException(exceptionInfo);
    });
  }

  private handleUnhandledException(exceptionInfo: any): void {
    const { exception } = exceptionInfo;

    const span = trace.getActiveSpan();
    if (span) {
      span.recordException(exception);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: exception.message || "Unhandled exception",
      });
    }

    this.logger.error(exception.stack);
  }
}
