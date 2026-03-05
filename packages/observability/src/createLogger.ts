import pino from 'pino';
import pinoHttp from 'pino-http';
import type { LoggerOptions } from './types.js';

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  '*.password',
  '*.token',
  '*.email',
];
const CENSOR = '[REDACTED]';

const DEFAULT_IGNORE_PATHS = ['/health', '/metrics'];

export function createLogger(options: LoggerOptions) {
  const {
    env,
    logLevel,
    logFile,
    lokiUrl,
    job,
    ignorePaths = DEFAULT_IGNORE_PATHS,
  } = options;

  const level = logLevel as pino.Level;
  const streams: pino.StreamEntry[] = [];

  if (env !== 'production') {
    streams.push({
      level,
      stream: pino.transport({
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard' },
      }),
    });
  } else {
    streams.push({ level, stream: process.stdout });
  }

  if (logFile) {
    streams.push({ level, stream: pino.destination(logFile) });
  }

  if (lokiUrl) {
    streams.push({
      level,
      stream: pino.transport({
        target: 'pino-loki',
        options: {
          host: lokiUrl,
          labels: { job },
          batching: { interval: 1 },
          silenceErrors: false,
        },
      }),
    });
  }

  const logger = pino(
    {
      level: logLevel,
      formatters: {
        level: (label) => ({ level: label }),
        bindings: () => ({}),
      },
      redact: { paths: REDACT_PATHS, censor: CENSOR },
    },
    pino.multistream(streams),
  );

  const httpLogger = pinoHttp({
    logger,
    genReqId: (req) =>
      (req.headers['x-request-id'] as string) ?? crypto.randomUUID(),
    customProps: (req) => ({
      requestId: req.headers['x-request-id'],
    }),
    autoLogging: {
      ignore: (req) => {
        const url = req.url ?? '';
        return ignorePaths.some(
          (path) => url === path || url.startsWith(path + '/'),
        );
      },
    },
    serializers: {
      req(req) {
        return { method: req.method, url: req.url };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  });

  return { logger, httpLogger };
}
