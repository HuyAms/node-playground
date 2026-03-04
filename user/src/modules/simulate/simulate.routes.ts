import { Router, type Request, type Response } from 'express';

export const simulateRouter = Router();

simulateRouter.get('/slow', async (req: Request, res: Response) => {
  const ms = Math.min(Number(req.query['ms']) || 500, 10_000);
  await new Promise(resolve => setTimeout(resolve, ms));
  res.json({ delayed_ms: ms });
});

simulateRouter.get('/error', (req: Request, res: Response) => {
  const rate = Math.min(Math.max(Number(req.query['rate']) || 0.5, 0), 1);
  if (Math.random() < rate) {
    res.status(500).json({ error: { code: 'SIMULATED_ERROR', message: 'Simulated server error' } });
    return;
  }
  res.json({ ok: true });
});

simulateRouter.get('/cpu', (req: Request, res: Response) => {
  const duration = Math.min(Number(req.query['duration']) || 1000, 10_000);
  const end = Date.now() + duration;
  let i = 0;
  while (Date.now() < end) i++;
  res.json({ iterations: i, duration_ms: duration });
});
