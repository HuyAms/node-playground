import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/index.js';
import { logger } from '../logger.js';

/**
 * Centralized error middleware — the single location where errors are
 * serialized to HTTP responses. Key invariants:
 *
 * 1. AppError subclasses are "operational" — known failure modes.
 *    They are warned at warn level (already logged by the service layer)
 *    and surfaced to the client with their designated status code.
 *
 * 2. Everything else is an unexpected failure.
 *    Log at error level (with full stack) and respond 500.
 *    We deliberately do NOT expose internal error messages to clients.
 *
 * 3. This is the ONLY place logger.error() is called.
 *    Service/repository layers use info/warn only.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const requestId = req.headers['x-request-id'] as string | undefined;

  if (err instanceof AppError) {
    logger.warn({ requestId, code: err.code, statusCode: err.statusCode }, err.message);
    res.status(err.statusCode).json(err.serialize(requestId));
    return;
  }

  // Unexpected failure — log everything, expose nothing
  logger.error(
    {
      err,
      requestId,
      method: req.method,
      url: req.url,
    },
    'Unhandled error',
  );

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      requestId,
    },
  });
}
