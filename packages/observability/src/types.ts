import type { Counter, Gauge, Histogram, Registry } from 'prom-client';

export interface LoggerOptions {
  env: 'development' | 'production' | 'test';
  logLevel: string;
  logFile?: string;
  lokiUrl?: string;
  /** Loki label for log stream (e.g. 'user-management', 'user-info') */
  job: string;
  /** Path prefixes to skip for HTTP auto-logging (e.g. ['/health', '/metrics', '/docs']) */
  ignorePaths?: string[];
}

export interface CreateMetricsOptions {
  /** Optional service-specific metrics; receive registry to attach metrics */
  extraMetrics?: (registry: Registry) => Record<string, Counter<string> | Gauge<string> | Histogram<string>>;
}

export interface HttpMetricsInstances {
  httpRequestsTotal: Counter<string>;
  httpRequestsInFlight: Gauge<string>;
  httpRequestDuration: Histogram<string>;
}
