import { config } from '../config.js';

export interface UserProfilePayload {
  userId: string;
  displayName: string;
  preferences: { theme?: string; locale?: string };
}

export async function getUserProfile(
  userId: string,
  requestId?: string,
): Promise<UserProfilePayload | null> {
  const baseUrl = config.userInfoServiceUrl.replace(/\/$/, '');
  const url = `${baseUrl}/user/${encodeURIComponent(userId)}/profile`;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (requestId) headers['x-request-id'] = requestId;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`user-info service returned ${res.status}`);
  }
  return (await res.json()) as UserProfilePayload;
}
