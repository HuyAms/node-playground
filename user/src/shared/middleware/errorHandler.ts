import {Request, Response, NextFunction} from 'express';
import {enrichWideEvent} from '@node-playground/observability';
import {AppError} from '../errors/index.js';

/**
 * Centralized error middleware — the single location where errors are
 * serialized to HTTP responses.
 *
 * Error context is added to the wide event via enrichWideEvent() and
 * emitted automatically by the wide event middleware at response finish.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const requestId = req.headers['x-request-id'] as string | undefined;

  if (err instanceof AppError) {
    enrichWideEvent({
      error: {type: err.constructor.name, message: err.message, statusCode: err.statusCode},
    });
    res.status(err.statusCode).json(err.serialize(requestId));
    return;
  }

  const message = err instanceof Error ? err.message : 'Unhandled error';
  const stack = err instanceof Error ? err.stack : undefined;
  enrichWideEvent({
    error: {type: 'UnhandledError', message, stack},
  });

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      requestId,
    },
  });
}
