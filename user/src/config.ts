import 'dotenv/config';

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function parseIntEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined) return fallback;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) throw new Error(`Env var ${key} must be a valid integer, got: ${raw}`);
  return parsed;
}

function parseBoolEnv(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (raw === undefined) return fallback;
  return raw === 'true' || raw === '1';
}

const env = requireEnv('NODE_ENV', 'development') as 'development' | 'production' | 'test';

export const config = {
  env,
  port: parseIntEnv('PORT', 3000),
  logLevel: requireEnv('LOG_LEVEL', env === 'development' ? 'debug' : 'info'),
  logFile: env === 'development' ? 'logs/app.log' : undefined,
  lokiUrl: process.env.LOKI_URL ?? undefined,
  enableFakeSlowness: parseBoolEnv('ENABLE_FAKE_SLOWNESS', env !== 'test'),
  rateLimit: {
    windowMs: parseIntEnv('RATE_LIMIT_WINDOW_MS', 60_000),
    max: parseIntEnv('RATE_LIMIT_MAX', 100),
  },
  corsOrigin: requireEnv('CORS_ORIGIN', '*'),
  userInfoServiceUrl: process.env.USER_INFO_SERVICE_URL ?? 'http://localhost:3002',
} as const;

export type Config = typeof config;
