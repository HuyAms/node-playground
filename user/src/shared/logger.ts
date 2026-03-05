import { createLogger as createObservabilityLogger } from '@node-playground/observability';
import { config } from '../config.js';

const { logger, httpLogger } = createObservabilityLogger({
  env: config.env,
  logLevel: config.logLevel,
  logFile: config.logFile,
  lokiUrl: config.lokiUrl,
  job: 'user-management',
  ignorePaths: ['/health', '/metrics', '/docs'],
});

export { logger, httpLogger };
