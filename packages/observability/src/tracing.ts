import {NodeSDK} from '@opentelemetry/sdk-node';
import {OTLPTraceExporter} from '@opentelemetry/exporter-trace-otlp-http';
import {Resource} from '@opentelemetry/resources';
import {ATTR_SERVICE_NAME} from '@opentelemetry/semantic-conventions';
import {ExpressInstrumentation} from '@opentelemetry/instrumentation-express';
import {FetchInstrumentation} from '@opentelemetry/instrumentation-fetch';

export interface InitTracingOptions {
  serviceName: string;
  endpoint?: string;
}

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

  const sdk = new NodeSDK({
    resource,
    traceExporter,
    // ExpressInstrumentation: auto-instruments Express to create spans for incoming HTTP requests (routes, middleware).
    // FetchInstrumentation: auto-instruments the Fetch API to create spans for outgoing HTTP requests.
    instrumentations: [new ExpressInstrumentation(), new FetchInstrumentation()],
  });

  sdk.start();
}
