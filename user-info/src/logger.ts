import { createLogger as createObservabilityLogger } from '@node-playground/observability';
import { config } from './config.js';

const { logger, httpLogger } = createObservabilityLogger({
  env: config.env,
  logLevel: config.logLevel,
  logFile: config.logFile,
  lokiUrl: config.lokiUrl,
  job: 'user-info',
  ignorePaths: ['/health', '/metrics'],
});

export { logger, httpLogger };
