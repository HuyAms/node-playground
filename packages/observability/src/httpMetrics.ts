import type { Request, Response, NextFunction } from 'express';
import type { HttpMetricsInstances } from './types.js';

function stripQueryString(url: string | undefined): string {
  return url?.split('?')[0] ?? '';
}

function getSegmentCount(path: string): number {
  if (path === '/' || path === '') return 0;
  return path.split('/').filter(Boolean).length;
}

function resolveRouteLabel(req: Request): string {
  if (!req.route) return 'unknown';

  const routePath = String(req.route.path);
  if (req.baseUrl) return `${req.baseUrl}${routePath}`;

  const requestPath = stripQueryString(req.originalUrl);
  const requestSegments = requestPath.split('/').filter(Boolean);
  const routeSegmentCount = getSegmentCount(routePath);

  if (routeSegmentCount === 0) return requestPath || routePath;
  if (requestSegments.length < routeSegmentCount) return routePath;

  const baseSegments = requestSegments.slice(0, requestSegments.length - routeSegmentCount);
  const basePath = baseSegments.length > 0 ? `/${baseSegments.join('/')}` : '';

  return `${basePath}${routePath}`;
}

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
    let route = 'unknown';
    httpRequestsInFlight.inc({ method: req.method });

    res.on('finish', () => {
      route = resolveRouteLabel(req);
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
