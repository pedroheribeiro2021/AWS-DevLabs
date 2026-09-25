import type { GamificationResult } from './gamification';

/** Encodes an XP-award result as a query string for the `<XpBanner>` on the destination page. */
export function buildGamificationQuery(gamification: GamificationResult | null): string {
  if (!gamification || gamification.xpAwarded <= 0) {
    return '';
  }

  const params = new URLSearchParams();
  params.set('xp', String(gamification.xpAwarded));
  if (gamification.leveledUp) {
    params.set('level', String(gamification.level));
  }
  if (gamification.streakExtended) {
    params.set('streak', String(gamification.currentStreak));
  }

  return `?${params.toString()}`;
}
