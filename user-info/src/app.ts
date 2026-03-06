import type {Request, Response, NextFunction} from 'express';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';

import {httpMetrics} from '@node-playground/observability';
import {registry, httpRequestsTotal, httpRequestsInFlight, httpRequestDuration} from './metrics.js';
import {httpLogger} from './logger.js';
import {requestId} from './middleware/requestId.js';
import {errorHandler} from './middleware/errorHandler.js';
import {AppError, NotFoundError} from './errors/index.js';
import {getProfileById} from './data/seedProfiles.js';
import {config} from './config.js';
import {delay} from './utils/delay.js';

async function fakeSlownessAndErrorMiddleware(
  _req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  if (config.enableFakeSlowness) {
    await delay(300 + Math.random() * 50);
  }
  if (Math.random() < config.fakeErrorRate) {
    next(new Error('user-info: DB connection failure'));
    return;
  }
  next();
}

export function createApp(): express.Application {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.use(requestId);
  app.use(httpLogger);
  app.use(httpMetrics({httpRequestsTotal, httpRequestsInFlight, httpRequestDuration}));

  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  });

  app.get('/health', (_req, res) => {
    res.status(200).json({status: 'ok'});
  });

  app.get('/user/:id/profile', fakeSlownessAndErrorMiddleware, (req, res, next) => {
    const profile = getProfileById(req.params.id);
    if (!profile) {
      next(new NotFoundError('User profile', req.params.id));
      return;
    }
    res.status(200).json(profile);
  });

  app.use((_req, res) => {
    res.status(404).json({error: {code: 'RESOURCE_NOT_FOUND', message: 'Route not found'}});
  });

  app.use(errorHandler);

  return app;
}
