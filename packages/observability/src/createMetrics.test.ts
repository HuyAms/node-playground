import { describe, it, expect } from 'vitest';
import { Counter } from 'prom-client';
import { createMetrics } from './createMetrics.js';

describe('createMetrics', () => {
  it('returns registry and HTTP metrics', () => {
    const m = createMetrics();
    expect(m.registry).toBeDefined();
    expect(m.httpRequestsTotal).toBeDefined();
    expect(m.httpRequestsInFlight).toBeDefined();
    expect(m.httpRequestDuration).toBeDefined();
  });

  it('includes extraMetrics in return when provided', () => {
    const m = createMetrics({
      extraMetrics: (reg) => ({
        customCounter: new Counter({
          name: 'custom_total',
          help: 'Test',
          registers: [reg],
        }),
      }),
    });
    expect((m as typeof m & { customCounter: Counter<string> }).customCounter).toBeDefined();
  });
});
