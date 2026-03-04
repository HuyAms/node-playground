import express from 'express';
import helmet from 'helmet';
import cors from 'cors';

import { registry } from './metrics.js';
import { httpLogger } from './logger.js';
import { requestId } from './middleware/requestId.js';
import { httpMetrics } from './middleware/httpMetrics.js';
import { getProfileById } from './data/seedProfiles.js';

export function createApp(): express.Application {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.use(requestId);
  app.use(httpLogger);
  app.use(httpMetrics);

  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  });

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.get('/user/:id/profile', (req, res) => {
    const profile = getProfileById(req.params.id);
    if (!profile) {
      res.status(404).json({ error: { code: 'PROFILE_NOT_FOUND', message: 'User profile not found' } });
      return;
    }
    res.status(200).json(profile);
  });

  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Route not found' } });
  });

  return app;
}
