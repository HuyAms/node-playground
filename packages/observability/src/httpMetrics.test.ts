import { describe, it, expect, vi } from 'vitest';
import { createMetrics, httpMetrics } from './index.js';

describe('httpMetrics', () => {
  it('returns middleware that calls next()', () => {
    const m = createMetrics();
    const middleware = httpMetrics({
      httpRequestsTotal: m.httpRequestsTotal,
      httpRequestsInFlight: m.httpRequestsInFlight,
      httpRequestDuration: m.httpRequestDuration,
    });
    const next = vi.fn();
    middleware(
      { method: 'GET', baseUrl: '', route: { path: '/test' } } as any,
      { on: vi.fn(), statusCode: 200 } as any,
      next,
    );
    expect(next).toHaveBeenCalled();
  });
});
