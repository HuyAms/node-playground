import { Request, Response, NextFunction } from 'express';

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const existingId = req.headers['x-request-id'];
  const id = typeof existingId === 'string' && existingId.trim() !== '' ? existingId : crypto.randomUUID();

  req.headers['x-request-id'] = id;
  res.setHeader('x-request-id', id);

  next();
}
