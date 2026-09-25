import { describe, expect, it } from 'vitest';
import { updateStreak } from './streak.js';

describe('updateStreak', () => {
  const noon = (isoDate: string) => new Date(`${isoDate}T12:00:00.000Z`);

  it('starts a streak of 1 on first-ever activity', () => {
    const result = updateStreak(
      { currentStreak: 0, longestStreak: 0, lastActivityDate: null },
      noon('2026-01-10'),
    );
    expect(result).toEqual({ currentStreak: 1, longestStreak: 1, streakExtended: true });
  });

  it('does not change the streak on a second activity the same day', () => {
    const result = updateStreak(
      { currentStreak: 3, longestStreak: 5, lastActivityDate: noon('2026-01-10') },
      new Date('2026-01-10T23:59:00.000Z'),
    );
    expect(result).toEqual({ currentStreak: 3, longestStreak: 5, streakExtended: false });
  });

  it('extends the streak by one on consecutive-day activity', () => {
    const result = updateStreak(
      { currentStreak: 3, longestStreak: 5, lastActivityDate: noon('2026-01-10') },
      noon('2026-01-11'),
    );
    expect(result).toEqual({ currentStreak: 4, longestStreak: 5, streakExtended: true });
  });

  it('raises the record when a new streak surpasses the previous longest', () => {
    const result = updateStreak(
      { currentStreak: 5, longestStreak: 5, lastActivityDate: noon('2026-01-10') },
      noon('2026-01-11'),
    );
    expect(result).toEqual({ currentStreak: 6, longestStreak: 6, streakExtended: true });
  });

  it('resets to 1 after skipping a day, but keeps the longest-streak record', () => {
    const result = updateStreak(
      { currentStreak: 10, longestStreak: 10, lastActivityDate: noon('2026-01-10') },
      noon('2026-01-13'),
    );
    expect(result).toEqual({ currentStreak: 1, longestStreak: 10, streakExtended: true });
  });
});
