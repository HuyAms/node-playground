import type {IncomingMessage} from 'node:http';
import {NodeSDK} from '@opentelemetry/sdk-node';
import {OTLPTraceExporter} from '@opentelemetry/exporter-trace-otlp-http';
import {Resource} from '@opentelemetry/resources';
import {ATTR_SERVICE_NAME} from '@opentelemetry/semantic-conventions';
import {HttpInstrumentation} from '@opentelemetry/instrumentation-http';
import {ExpressInstrumentation} from '@opentelemetry/instrumentation-express';
import {UndiciInstrumentation} from '@opentelemetry/instrumentation-undici';

const HEALTH_METRICS_PATHS = new Set(['/health', '/metrics']);

function ignoreHealthAndMetrics(req: IncomingMessage): boolean {
  const path = req.url?.split('?')[0] ?? '';
  return HEALTH_METRICS_PATHS.has(path);
}

function shouldIgnoreOutgoingRequest(path: string): boolean {
  const pathname = path?.split('?')[0] ?? '';
  return HEALTH_METRICS_PATHS.has(pathname);
}

export interface InitTracingOptions {
  serviceName: string;
  endpoint?: string;
}

let sdk: NodeSDK | undefined;

export function initTracing(options: InitTracingOptions): void {
  const endpoint =
    options.endpoint ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318';
  const url = endpoint.includes('/v1/traces')
    ? endpoint
    : `${endpoint.replace(/\/$/, '')}/v1/traces`;

  const resource = new Resource({
    [ATTR_SERVICE_NAME]: options.serviceName,
  });

  const traceExporter = new OTLPTraceExporter({url});

  sdk = new NodeSDK({
    resource,
    traceExporter,
    // HttpInstrumentation: Node http/https layer (required base for Express).
    // ExpressInstrumentation: Express routes/middleware.
    // UndiciInstrumentation: Node fetch() / undici (outbound); propagates trace context.
    instrumentations: [
      new HttpInstrumentation({
        ignoreIncomingRequestHook: ignoreHealthAndMetrics,
      }),
      new ExpressInstrumentation(),
      new UndiciInstrumentation({
        ignoreRequestHook: (req) => shouldIgnoreOutgoingRequest(req.path),
      }),
    ],
  });

  sdk.start();
}

export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = undefined;
  }
}
