import pino from 'pino';
import pinoHttp from 'pino-http';
import { config } from '../config.js';

export const logger = pino({
  level: config.logLevel,
  // In non-production, pretty-print; in production use JSON for structured log aggregators
  transport:
    config.env !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
      : undefined,
  // Redact common sensitive field paths — belt-and-suspenders
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token'],
    censor: '[REDACTED]',
  },
});

export const httpLogger = pinoHttp({
  logger,
  // Reuse the request-id assigned by our requestId middleware
  genReqId: (req) => req.headers['x-request-id'] as string | undefined,
  customProps: (req) => ({
    requestId: req.headers['x-request-id'],
  }),
  // Suppress noisy health-check routes if added later
  autoLogging: {
    ignore: (req) => req.url === '/health',
  },
  serializers: {
    req(req) {
      return {
        method: req.method,
        url: req.url,
        // Don't log full headers; they may contain auth material
      };
    },
    res(res) {
      return { statusCode: res.statusCode };
    },
  },
});
