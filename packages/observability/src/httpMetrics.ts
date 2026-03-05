import type { Request, Response, NextFunction } from 'express';
import type { HttpMetricsInstances } from './types.js';

export function httpMetrics(
  metrics: HttpMetricsInstances,
): (req: Request, res: Response, next: NextFunction) => void {
  const {
    httpRequestsTotal,
    httpRequestsInFlight,
    httpRequestDuration,
  } = metrics;

  return function middleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const startTime = performance.now();
    httpRequestsInFlight.inc({ method: req.method });

    res.on('finish', () => {
      const route = req.route
        ? `${req.baseUrl}${req.route.path}`
        : 'unknown';
      const durationSeconds = (performance.now() - startTime) / 1000;

      httpRequestsInFlight.dec({ method: req.method });

      httpRequestsTotal.inc({
        method: req.method,
        route,
        status_code: String(res.statusCode),
      });

      httpRequestDuration.observe(
        {
          method: req.method,
          route,
          status_code: String(res.statusCode),
        },
        durationSeconds,
      );
    });

    next();
  };
}
