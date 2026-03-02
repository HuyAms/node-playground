import type { Request, Response, NextFunction } from 'express';
import { httpRequestsTotal, httpRequestsInFlight } from '../metrics.js';

export function httpMetrics(req: Request, res: Response, next: NextFunction): void {
  httpRequestsInFlight.inc({ method: req.method });

  res.on('finish', () => {
    const route = req.route?.path ?? 'unknown';
    httpRequestsInFlight.dec({ method: req.method });
    httpRequestsTotal.inc({
      method: req.method,
      route,
      status_code: String(res.statusCode),
    });
  });

  next();
}
