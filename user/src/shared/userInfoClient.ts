import { trace, SpanStatusCode } from '@opentelemetry/api';
import { config } from '../config.js';

const tracer = trace.getTracer('userInfo-client', '1.0');

export interface UserProfilePayload {
  userId: string;
  displayName: string;
  preferences: { theme?: string; locale?: string };
}

export async function getUserProfile(
  userId: string,
  requestId?: string,
): Promise<UserProfilePayload> {
  const baseUrl = config.userInfoServiceUrl.replace(/\/$/, '');
  const path = `/user/${encodeURIComponent(userId)}/profile`;
  const url = `${baseUrl}${path}`;

  return tracer.startActiveSpan(
    'fetch profile',
    { attributes: { 'user.id': userId, 'http.target': path } },
    async (span) => {
      try {
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (requestId) headers['x-request-id'] = requestId;

        const res = await fetch(url, { headers });
        if (!res.ok) {
          throw new Error(`user-info service returned ${res.status}`);
        }
        return (await res.json()) as UserProfilePayload;
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw err;
      } finally {
        span.end();
      }
    },
  );
}
