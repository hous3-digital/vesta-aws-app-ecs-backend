import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from "@nestjs/common";
import type { Response } from "express";
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  InvalidStateError,
  NotFoundError,
  ValidationError,
} from "@src/shared/errors";

export interface DomainErrorBody {
  statusCode: number;
  code: string;
  message: string;
  error: string;
}

const STATUS_BY_ERROR: ReadonlyArray<[new (...args: never[]) => DomainError, HttpStatus]> = [
  [NotFoundError, HttpStatus.NOT_FOUND],
  [ConflictError, HttpStatus.CONFLICT],
  [InvalidStateError, HttpStatus.UNPROCESSABLE_ENTITY],
  [ForbiddenError, HttpStatus.FORBIDDEN],
  [ValidationError, HttpStatus.BAD_REQUEST],
];

/**
 * Maps `DomainError` subclasses to HTTP. The body keeps the shape Nest uses
 * for `HttpException` (`statusCode`, `message`, `error`) and adds `code`, so
 * existing clients keep working and new ones can branch on a stable value.
 * `details` is logged, never returned: it may carry internal identifiers.
 */
@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter<DomainError> {
  private readonly logger = new Logger(DomainErrorFilter.name);

  public catch(exception: DomainError, host: ArgumentsHost): void {
    const statusCode = DomainErrorFilter.statusOf(exception);
    const body: DomainErrorBody = {
      statusCode: statusCode,
      code: exception.code,
      message: exception.message,
      error: exception.name,
    };

    this.logger.warn(`${exception.name} ${exception.code}: ${exception.message}`, exception.details);

    host.switchToHttp().getResponse<Response>().status(statusCode).json(body);
  }

  public static statusOf(exception: DomainError): HttpStatus {
    const match = STATUS_BY_ERROR.find(([errorClass]) => exception instanceof errorClass);
    return match ? match[1] : HttpStatus.INTERNAL_SERVER_ERROR;
  }
}
