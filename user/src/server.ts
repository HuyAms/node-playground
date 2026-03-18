import './instrumentation.js';
import fs from 'node:fs';
import { shutdownTracing } from '@node-playground/observability';
import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './shared/logger.js';
import { SqliteUserRepository } from './modules/users/sqlite.repository.js';

if (config.logFile) {
  fs.mkdirSync('logs', { recursive: true });
  fs.writeFileSync(config.logFile, '');
}

const userRepository = new SqliteUserRepository(config.databasePath);
const app = createApp(userRepository);

const server = app.listen(config.port, () => {
  logger.info(
    { port: config.port, env: config.env },
    `Server listening on port ${config.port}`,
  );
});

// Graceful shutdown — give in-flight requests time to finish
function shutdown(signal: string): void {
  logger.info({ signal }, 'Shutdown signal received, closing server');
  server.close(async () => {
    userRepository.close();
    await shutdownTracing();
    logger.info('Server closed');
    process.exit(0);
  });

  // Force exit if graceful close exceeds 10 seconds
  setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Surface unhandled promise rejections rather than silently swallowing them
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
  process.exit(1);
});
