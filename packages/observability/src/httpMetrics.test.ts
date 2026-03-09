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

  it('records mounted router paths with their mount prefix', async () => {
    const m = createMetrics();
    const middleware = httpMetrics({
      httpRequestsTotal: m.httpRequestsTotal,
      httpRequestsInFlight: m.httpRequestsInFlight,
      httpRequestDuration: m.httpRequestDuration,
    });
    const next = vi.fn();
    let finishHandler: (() => void) | undefined;
    const req = {
      method: 'PATCH',
      baseUrl: '/users',
      originalUrl: '/users/123',
      route: { path: '/:id' },
    } as any;
    const res = {
      on: vi.fn((event: string, handler: () => void) => {
        if (event === 'finish') finishHandler = handler;
      }),
      statusCode: 200,
    } as any;

    middleware(req, res, next);
    req.baseUrl = '';
    finishHandler?.();

    const metrics = await m.registry.metrics();

    expect(next).toHaveBeenCalled();
    expect(metrics).toContain('route="/users/:id"');
  });
});
