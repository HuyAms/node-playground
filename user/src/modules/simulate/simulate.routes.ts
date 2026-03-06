import { Router, type Request, type Response } from 'express';

export const simulateRouter = Router();

simulateRouter.get('/cpu', (req: Request, res: Response) => {
  const duration = Math.min(Number(req.query['duration']) || 1000, 10_000);
  const end = Date.now() + duration;
  let i = 0;
  while (Date.now() < end) i++;
  res.json({ iterations: i, duration_ms: duration });
});
