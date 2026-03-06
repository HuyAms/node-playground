import type {Request, Response, NextFunction} from 'express';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';

import {httpMetrics} from '@node-playground/observability';
import {registry, httpRequestsTotal, httpRequestsInFlight, httpRequestDuration} from './metrics.js';
import {httpLogger} from './logger.js';
import {requestId} from './middleware/requestId.js';
import {getProfileById} from './data/seedProfiles.js';
import {config} from './config.js';
import {delay} from './utils/delay.js';

async function fakeSlownessAndErrorMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (config.enableFakeSlowness) {
    await delay(300 + Math.random() * 50);
  }
  if (Math.random() < config.fakeErrorRate) {
    res
      .status(500)
      .json({error: {code: 'FAKE_ERROR', message: 'user-info: DB connection failure'}});
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

  app.get('/user/:id/profile', fakeSlownessAndErrorMiddleware, (req, res) => {
    const profile = getProfileById(req.params.id);
    if (!profile) {
      res.status(404).json({error: {code: 'PROFILE_NOT_FOUND', message: 'User profile not found'}});
      return;
    }
    res.status(200).json(profile);
  });

  app.use((_req, res) => {
    res.status(404).json({error: {code: 'RESOURCE_NOT_FOUND', message: 'Route not found'}});
  });

  return app;
}
