import {delay} from '../utils/delay.js';

export interface UserProfile {
  userId: string;
  displayName: string;
  preferences: {
    theme?: string;
    locale?: string;
  };
}

const SEED_PROFILES: UserProfile[] = [
  { userId: '1', displayName: 'Alice N.', preferences: { theme: 'dark', locale: 'en-US' } },
  { userId: '2', displayName: 'Bob C.', preferences: { theme: 'light', locale: 'en-GB' } },
  { userId: '3', displayName: 'Carol S.', preferences: { theme: 'system', locale: 'en-US' } },
  { userId: '4', displayName: 'David K.', preferences: { theme: 'dark', locale: 'ko-KR' } },
  { userId: '5', displayName: 'Eva M.', preferences: { theme: 'light', locale: 'es-ES' } },
  { userId: '6', displayName: 'Frank O.', preferences: { theme: 'dark', locale: 'en-US' } },
  { userId: '7', displayName: 'Grace L.', preferences: { theme: 'light', locale: 'zh-CN' } },
  { userId: '8', displayName: 'Henry P.', preferences: { theme: 'system', locale: 'en-US' } },
];

const profileByUserId = new Map<string, UserProfile>(
  SEED_PROFILES.map((p) => [p.userId, p]),
);

export async function getProfileById(userId: string): Promise<UserProfile | undefined> {
  await delay(300 + Math.random() * 50);
  return profileByUserId.get(userId);
}
