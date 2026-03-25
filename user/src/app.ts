import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';

import type { UserRepository } from './modules/users/users.repository.js';
import { createUsersRoutes } from './modules/users/users.routes.js';
import { httpMetrics, createWideEventMiddleware } from '@node-playground/observability';
import { config } from './config.js';
import { registry, httpRequestsTotal, httpRequestsInFlight, httpRequestDuration } from './shared/metrics.js';
import { logger } from './shared/logger.js';
import { requestId } from './shared/middleware/requestId.js';
import { errorHandler } from './shared/middleware/errorHandler.js';
import {simulateRouter} from './modules/simulate/simulate.routes.js';
import {swaggerSpec} from './docs/swagger.js';

export function createApp(userRepository: UserRepository): express.Application {
  const app = express();
  const {usersRouter, userInfoRouter} = createUsersRoutes(userRepository);

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
    })
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
    })
  );

  // ------------------------------------------------------------------
  // Request enrichment
  // ------------------------------------------------------------------
  app.use(requestId);
  app.use(createWideEventMiddleware(logger, {ignorePaths: ['/health', '/metrics', '/docs']}));
  app.use(httpMetrics({ httpRequestsTotal, httpRequestsInFlight, httpRequestDuration }));

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
  // Metrics — scraped by Prometheus every 15s
  // ------------------------------------------------------------------
  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  });

  // ------------------------------------------------------------------
  // Health check (intentionally simple — no auth, no business logic)
  // ------------------------------------------------------------------
  app.get('/health', (_req, res) => {
    res.status(200).json({status: 'ok'});
  });

  // ------------------------------------------------------------------
  // Feature routes
  // ------------------------------------------------------------------
  app.use('/user', userInfoRouter);
  app.use('/users', usersRouter);
  app.use('/simulate', simulateRouter);

  // ------------------------------------------------------------------
  // 404 fallthrough — must be after all routes
  // ------------------------------------------------------------------
  app.use((_req, res) => {
    res.status(404).json({
      error: {code: 'RESOURCE_NOT_FOUND', message: 'Route not found'},
    });
  });

  // ------------------------------------------------------------------
  // Centralized error handler — must be last, 4-arg signature required
  // ------------------------------------------------------------------
  app.use(errorHandler);

  return app;
}
