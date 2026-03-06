import { initTracing } from '@node-playground/observability';

initTracing({
  serviceName: 'user',
  endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
});
