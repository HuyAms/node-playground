import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';

import { config } from './config.js';
import { httpLogger } from './shared/logger.js';
import { requestId } from './shared/middleware/requestId.js';
import { errorHandler } from './shared/middleware/errorHandler.js';
import { usersRouter } from './modules/users/users.routes.js';
import { swaggerSpec } from '../docs/swagger.js';

export function createApp(): express.Application {
  const app = express();

  // ------------------------------------------------------------------
  // Security middleware
  // ------------------------------------------------------------------
  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigin,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'x-request-id'],
      exposedHeaders: ['x-request-id'],
    }),
  );
  app.use(
    rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.max,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests, please try again later.',
        },
      },
    }),
  );

  // ------------------------------------------------------------------
  // Request enrichment
  // ------------------------------------------------------------------
  app.use(requestId);   // must come before httpLogger so pino picks up x-request-id
  app.use(httpLogger);

  // ------------------------------------------------------------------
  // Body parsing
  // ------------------------------------------------------------------
  app.use(express.json());

  // ------------------------------------------------------------------
  // API Documentation
  // ------------------------------------------------------------------
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/docs.json', (_req, res) => res.json(swaggerSpec));

  // ------------------------------------------------------------------
  // Health check (intentionally simple — no auth, no business logic)
  // ------------------------------------------------------------------
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // ------------------------------------------------------------------
  // Feature routes
  // ------------------------------------------------------------------
  app.use('/users', usersRouter);

  // ------------------------------------------------------------------
  // 404 fallthrough — must be after all routes
  // ------------------------------------------------------------------
  app.use((_req, res) => {
    res.status(404).json({
      error: { code: 'RESOURCE_NOT_FOUND', message: 'Route not found' },
    });
  });

  // ------------------------------------------------------------------
  // Centralized error handler — must be last, 4-arg signature required
  // ------------------------------------------------------------------
  app.use(errorHandler);

  return app;
}
