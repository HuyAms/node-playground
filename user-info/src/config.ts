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

function parseFloatEnv(key: string, fallback: number, min = 0, max = 1): number {
  const raw = process.env[key];
  if (raw === undefined) return fallback;
  const parsed = parseFloat(raw);
  if (isNaN(parsed)) throw new Error(`Env var ${key} must be a valid number, got: ${raw}`);
  return Math.max(min, Math.min(max, parsed));
}

const env = requireEnv('NODE_ENV', 'development') as 'development' | 'production' | 'test';

export const config = {
  env,
  port: parseIntEnv('PORT', 3000),
  logLevel: requireEnv('LOG_LEVEL', 'info'),
  logFile: env === 'development' ? 'logs/app.log' : undefined,
  lokiUrl: process.env.LOKI_URL ?? undefined,
  enableFakeSlowness: parseBoolEnv('ENABLE_FAKE_SLOWNESS', true),
  fakeErrorRate: parseFloatEnv('USER_INFO_FAKE_ERROR_RATE', 0.1),
} as const;

export type Config = typeof config;
