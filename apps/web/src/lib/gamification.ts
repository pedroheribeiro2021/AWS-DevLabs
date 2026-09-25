import { cookies } from 'next/headers';
import { apiFetch } from './api';
import { ACCESS_TOKEN_COOKIE } from './auth-cookies';

export interface BadgeStatus {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedAt: string | null;
}

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export interface GamificationStats {
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpForLevel: number;
  currentStreak: number;
  longestStreak: number;
  badges: BadgeStatus[];
}

export interface GamificationResult extends Omit<GamificationStats, 'badges'> {
  xpAwarded: number;
  leveledUp: boolean;
  streakExtended: boolean;
  newBadges: BadgeDefinition[];
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
