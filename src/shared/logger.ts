import pino from 'pino';
import pinoHttp from 'pino-http';
import { config } from '../config.js';

function buildStreams(): pino.StreamEntry[] {
  const level = config.logLevel as pino.Level;
  const streams: pino.StreamEntry[] = [];

  if (config.env !== 'production') {
    streams.push({
      level,
      stream: pino.transport({ target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }),
    });
  } else {
    streams.push({ level, stream: process.stdout });
  }

  if (config.logFile) {
    streams.push({ level, stream: pino.destination(config.logFile) });
  }

  return streams;
}

export const logger = pino(
  {
    level: config.logLevel,
    formatters: {
      level: (label) => ({ level: label }),
      bindings: () => ({}),
    },
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token', '*.email'],
      censor: '[REDACTED]',
    },
  },
  pino.multistream(buildStreams()),
);

export const httpLogger = pinoHttp({
  logger,
  // Reuse the request-id assigned by our requestId middleware
  genReqId: (req) => (req.headers['x-request-id'] as string) ?? crypto.randomUUID(),
  customProps: (req) => ({
    requestId: req.headers['x-request-id'],
  }),
  autoLogging: {
    ignore: (req) => req.url === '/health' || (req.url?.startsWith('/docs') ?? false),
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
