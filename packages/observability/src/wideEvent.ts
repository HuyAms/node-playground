import {AsyncLocalStorage} from 'node:async_hooks';
import type {Request, Response, NextFunction} from 'express';
import type pino from 'pino';

export type WideEvent = Record<string, unknown>;

const storage = new AsyncLocalStorage<WideEvent>();

export function getWideEvent(): WideEvent | undefined {
  return storage.getStore();
}

export function enrichWideEvent(data: Record<string, unknown>): void {
  const event = storage.getStore();
  if (event) Object.assign(event, data);
}

export interface WideEventMiddlewareOptions {
  ignorePaths?: string[];
}

const DEFAULT_IGNORE_PATHS = ['/health', '/metrics'];

export function createWideEventMiddleware(
  logger: pino.Logger,
  options: WideEventMiddlewareOptions = {}
) {
  const {ignorePaths = DEFAULT_IGNORE_PATHS} = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const url = req.url ?? '';
    if (ignorePaths.some(p => url === p || url.startsWith(p + '/'))) {
      return next();
    }

    const startTime = Date.now();
    const wideEvent: WideEvent = {
      requestId: req.headers['x-request-id'],
      method: req.method,
      path: req.path,
    };

    res.on('finish', () => {
      wideEvent.statusCode = res.statusCode;
      wideEvent.durationMs = Date.now() - startTime;

      if (res.statusCode >= 500) {
        logger.error(wideEvent, 'request completed');
      } else {
        logger.info(wideEvent, 'request completed');
      }
    });

    storage.run(wideEvent, () => next());
  };
}
