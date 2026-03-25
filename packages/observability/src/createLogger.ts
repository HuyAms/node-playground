import pino from 'pino';
import type {LoggerOptions} from './types.js';

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  '*.password',
  '*.token',
  '*.email',
];
const CENSOR = '[REDACTED]';

export function createLogger(options: LoggerOptions) {
  const {env, logLevel, logFile, lokiUrl, job} = options;

  const level = logLevel as pino.Level;
  const streams: pino.StreamEntry[] = [];

  if (env !== 'production') {
    streams.push({
      level,
      stream: pino.transport({
        target: 'pino-pretty',
        options: {colorize: true, translateTime: 'SYS:standard'},
      }),
    });
  } else {
    streams.push({level, stream: process.stdout});
  }

  if (logFile) {
    streams.push({level, stream: pino.destination(logFile)});
  }

  if (lokiUrl) {
    streams.push({
      level,
      stream: pino.transport({
        target: 'pino-loki',
        options: {
          host: lokiUrl,
          labels: {job},
          propsToLabels: ['level'],
          batching: {interval: 1},
          silenceErrors: false,
        },
      }),
    });
  }

  const logger = pino(
    {
      level: logLevel,
      name: job,
      base: {
        service: job,
        environment: env,
      },
      formatters: {
        level: label => ({level: label}),
      },
      redact: {paths: REDACT_PATHS, censor: CENSOR},
    },
    pino.multistream(streams)
  );

  return {logger};
}
