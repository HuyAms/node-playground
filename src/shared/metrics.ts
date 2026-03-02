import { Registry, collectDefaultMetrics, Counter, Gauge } from 'prom-client';

export const registry = new Registry();

collectDefaultMetrics({ register: registry });

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [registry],
});

export const httpRequestsInFlight = new Gauge({
  name: 'http_requests_in_flight',
  help: 'Number of HTTP requests currently being processed',
  labelNames: ['method'] as const,
  registers: [registry],
});
