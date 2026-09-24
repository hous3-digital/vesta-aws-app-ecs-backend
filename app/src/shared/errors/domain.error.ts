/**
 * Base class for errors raised by entities, value objects and domain services.
 * The domain never imports Nest; `DomainErrorFilter` in `src/infra/http`
 * maps each subclass to an HTTP status and returns `code` to the client.
 */
export abstract class DomainError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** The aggregate or resource does not exist. Maps to 404. */
export class NotFoundError extends DomainError {}

/** The operation collides with existing state (duplicate, already done). Maps to 409. */
export class ConflictError extends DomainError {}

/** The aggregate is in a state that does not allow the transition. Maps to 422. */
export class InvalidStateError extends DomainError {}

/** The caller is authenticated but may not act on this resource. Maps to 403. */
export class ForbiddenError extends DomainError {}

/** The input is well-formed but violates a domain rule. Maps to 400. */
export class ValidationError extends DomainError {}
