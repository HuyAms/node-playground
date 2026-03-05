import {
  Registry,
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
} from 'prom-client';
import type { CreateMetricsOptions } from './types.js';

const HTTP_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5];

export function createMetrics(options: CreateMetricsOptions = {}) {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry });

  const httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'] as const,
    registers: [registry],
  });

  const httpRequestsInFlight = new Gauge({
    name: 'http_requests_in_flight',
    help: 'Number of HTTP requests currently being processed',
    labelNames: ['method'] as const,
    registers: [registry],
  });

  const httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'] as const,
    buckets: HTTP_BUCKETS,
    registers: [registry],
  });

  const extra = options.extraMetrics?.(registry) ?? {};

  return {
    registry,
    httpRequestsTotal,
    httpRequestsInFlight,
    httpRequestDuration,
    ...extra,
  };
}
