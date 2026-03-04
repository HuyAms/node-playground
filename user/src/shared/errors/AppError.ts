export type ErrorCode =
  | 'RESOURCE_NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'INTERNAL_SERVER_ERROR';

export interface SerializedError {
  code: ErrorCode;
  message: string;
  details?: unknown;
  requestId?: string;
}

/**
 * Base class for all operational errors — errors we anticipate and explicitly handle.
 * Anything NOT an AppError in the error middleware is treated as an unexpected failure (500).
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: unknown;
  public readonly isOperational = true;

  constructor(message: string, statusCode: number, code: ErrorCode, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    // Restore prototype chain — required when extending built-ins in TypeScript
    Object.setPrototypeOf(this, new.target.prototype);
  }

  serialize(requestId?: string): { error: SerializedError } {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details !== undefined && { details: this.details }),
        ...(requestId && { requestId }),
      },
    };
  }
}
