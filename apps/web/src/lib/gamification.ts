import { cookies } from 'next/headers';
import { apiFetch } from './api';
import { ACCESS_TOKEN_COOKIE } from './auth-cookies';

export interface GamificationStats {
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpForLevel: number;
  currentStreak: number;
  longestStreak: number;
}

export interface GamificationResult extends GamificationStats {
  xpAwarded: number;
  leveledUp: boolean;
  streakExtended: boolean;
}

async function authorizedFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  return apiFetch<T>(path, {
    ...init,
    headers: {
      ...init?.headers,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });
}

export function getGamificationStats(): Promise<GamificationStats> {
  return authorizedFetch<GamificationStats>('/gamification/me');
}
