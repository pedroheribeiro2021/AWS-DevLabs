export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: Date | null;
}

export interface StreakUpdate {
  currentStreak: number;
  longestStreak: number;
  streakExtended: boolean;
}

function toDateOnlyUTC(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Recomputes the daily streak given the previous state and "now". A user who
 * already logged activity today keeps their streak unchanged; one who last
 * logged activity yesterday extends it by one; anyone else (first-ever
 * activity, or a gap of 2+ days) starts a fresh streak of 1.
 */
export function updateStreak(previous: StreakState, now: Date = new Date()): StreakUpdate {
  const today = toDateOnlyUTC(now);
  const lastDay = previous.lastActivityDate ? toDateOnlyUTC(previous.lastActivityDate) : null;

  if (lastDay === today) {
    return {
      currentStreak: previous.currentStreak,
      longestStreak: previous.longestStreak,
      streakExtended: false,
    };
  }

  const yesterday = toDateOnlyUTC(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const currentStreak = lastDay === yesterday ? previous.currentStreak + 1 : 1;

  return {
    currentStreak,
    longestStreak: Math.max(previous.longestStreak, currentStreak),
    streakExtended: true,
  };
}
