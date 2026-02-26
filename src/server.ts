import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './shared/logger.js';

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info(
    { port: config.port, env: config.env },
    `Server listening on port ${config.port}`,
  );
});

// Graceful shutdown — give in-flight requests time to finish
function shutdown(signal: string): void {
  logger.info({ signal }, 'Shutdown signal received, closing server');
  server.close(() => {
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
