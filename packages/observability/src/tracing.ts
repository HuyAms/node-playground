import {NodeSDK} from '@opentelemetry/sdk-node';
import {OTLPTraceExporter} from '@opentelemetry/exporter-trace-otlp-http';
import {Resource} from '@opentelemetry/resources';
import {ATTR_SERVICE_NAME} from '@opentelemetry/semantic-conventions';
import {getNodeAutoInstrumentations} from '@opentelemetry/auto-instrumentations-node';

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
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();
}

export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = undefined;
  }
}
