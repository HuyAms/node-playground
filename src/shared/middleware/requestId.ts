import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Reuse the caller-provided x-request-id if present and non-empty;
 * otherwise generate a UUID v4. Reflects the value back in the response
 * so clients can correlate logs without additional tooling.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const existingId = req.headers['x-request-id'];
  const id = typeof existingId === 'string' && existingId.trim() !== '' ? existingId : uuidv4();

  req.headers['x-request-id'] = id;
  res.setHeader('x-request-id', id);

  next();
}
