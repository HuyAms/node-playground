import { trace } from '@opentelemetry/api';
import { Router, type Request, type Response } from 'express';

const tracer = trace.getTracer('simulate', '1.0');

export const simulateRouter = Router();

simulateRouter.get('/cpu', (req: Request, res: Response) => {
  const duration = Math.min(Number(req.query['duration']) || 1000, 10_000);

  tracer.startActiveSpan(
    'simulate cpu',
    { attributes: { duration_ms: duration } },
    (span) => {
      try {
        const end = Date.now() + duration;
        let i = 0;
        while (Date.now() < end) i++;
        span.setAttribute('iterations', i);
        res.json({ iterations: i, duration_ms: duration });
      } finally {
        span.end();
      }
    },
  );
});
