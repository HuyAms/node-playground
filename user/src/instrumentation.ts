import {initTracing} from '@node-playground/observability/tracing';

initTracing({
  serviceName: 'user',
  endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
});
