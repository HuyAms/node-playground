import { Counter, Gauge } from 'prom-client';
import { createMetrics } from '@node-playground/observability';

const base = createMetrics({
  extraMetrics: (reg) => ({
    cacheHitsTotal: new Counter({
      name: 'cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['cache'] as const,
      registers: [reg],
    }),
    cacheMissesTotal: new Counter({
      name: 'cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['cache'] as const,
      registers: [reg],
    }),
    cacheSize: new Gauge({
      name: 'cache_size',
      help: 'Current number of entries in the cache',
      labelNames: ['cache'] as const,
      registers: [reg],
    }),
  }),
});

export const { registry, httpRequestsTotal, httpRequestsInFlight, httpRequestDuration } = base;
export const cacheHitsTotal = (base as typeof base & { cacheHitsTotal: Counter<string> }).cacheHitsTotal;
export const cacheMissesTotal = (base as typeof base & { cacheMissesTotal: Counter<string> }).cacheMissesTotal;
export const cacheSize = (base as typeof base & { cacheSize: Gauge<string> }).cacheSize;
