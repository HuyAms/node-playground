import type {Request, Response, NextFunction} from 'express';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import {trace, SpanStatusCode} from '@opentelemetry/api';

import {httpMetrics} from '@node-playground/observability';
import {registry, httpRequestsTotal, httpRequestsInFlight, httpRequestDuration} from './metrics.js';
import {httpLogger} from './logger.js';
import {requestId} from './middleware/requestId.js';
import {errorHandler} from './middleware/errorHandler.js';
import {NotFoundError} from './errors/index.js';
import {getProfileById} from './data/seedProfiles.js';
import {config} from './config.js';
import {delay} from './utils/delay.js';

const tracer = trace.getTracer('user-info', '1.0');
const FORCED_ERROR_MESSAGE = 'Forced post-processing error via ?error=true';

function shouldForceError(req: Request): boolean {
  const value = req.query.error;

  if (Array.isArray(value)) {
    return value.includes('true');
  }

  return value === 'true';
}

async function fakeSlownessMiddleware(
  _req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  if (config.enableFakeSlowness) {
    await delay(300 + Math.random() * 50);
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

  app.get('/user/:id/profile', fakeSlownessMiddleware, (req, res, next) => {
    const userId = req.params.id;
    tracer.startActiveSpan(
      'get profile',
      {attributes: {'user.id': userId}},
      (span) => {
        try {
          const profile = getProfileById(userId);
          if (!profile) {
            const err = new NotFoundError('User profile', userId);
            span.recordException(err);
            span.setStatus({code: SpanStatusCode.ERROR});
            next(err);
            return;
          }

          if (shouldForceError(req)) {
            const err = new Error(FORCED_ERROR_MESSAGE);
            span.recordException(err);
            span.setStatus({code: SpanStatusCode.ERROR});
            next(err);
            return;
          }

          res.status(200).json(profile);
        } finally {
          span.end();
        }
      },
    );
  });

  app.use((_req, res) => {
    res.status(404).json({error: {code: 'RESOURCE_NOT_FOUND', message: 'Route not found'}});
  });

  app.use(errorHandler);

  return app;
}
