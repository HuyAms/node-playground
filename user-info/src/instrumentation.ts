import {initTracing} from '@node-playground/observability/tracing';

initTracing({
  serviceName: 'user-info',
  endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
});
