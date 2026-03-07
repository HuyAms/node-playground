import type {IncomingMessage} from 'node:http';
import {NodeSDK} from '@opentelemetry/sdk-node';
import {OTLPTraceExporter} from '@opentelemetry/exporter-trace-otlp-http';
import {Resource} from '@opentelemetry/resources';
import {ATTR_SERVICE_NAME} from '@opentelemetry/semantic-conventions';
import {HttpInstrumentation} from '@opentelemetry/instrumentation-http';
import {ExpressInstrumentation} from '@opentelemetry/instrumentation-express';
import {FetchInstrumentation} from '@opentelemetry/instrumentation-fetch';

const HEALTH_METRICS_PATHS = new Set(['/health', '/metrics']);

function ignoreHealthAndMetrics(req: IncomingMessage): boolean {
  const path = req.url?.split('?')[0] ?? '';
  return HEALTH_METRICS_PATHS.has(path);
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
    // ExpressInstrumentation: Express routes/middleware. FetchInstrumentation: Node fetch() + W3C propagation.
    instrumentations: [
      new HttpInstrumentation({
        ignoreIncomingRequestHook: ignoreHealthAndMetrics,
      }),
      new ExpressInstrumentation(),
      new FetchInstrumentation(),
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
