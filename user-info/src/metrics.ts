import { createMetrics } from '@node-playground/observability';

const { registry, httpRequestsTotal, httpRequestsInFlight, httpRequestDuration } =
  createMetrics();

export { registry, httpRequestsTotal, httpRequestsInFlight, httpRequestDuration };
