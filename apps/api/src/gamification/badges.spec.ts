import { describe, expect, it } from 'vitest';
import { BADGE_CATALOG, evaluateBadges } from './badges.js';

const emptyContext = {
  completedLessonCount: 0,
  completedLabCount: 0,
  correctQuestionCount: 0,
  submittedSimulationCount: 0,
  passedSimulationCount: 0,
  currentStreak: 0,
  level: 1,
};

describe('evaluateBadges', () => {
  it('earns nothing for a brand-new user', () => {
    expect(evaluateBadges(emptyContext)).toEqual([]);
  });

  it('earns first-completion badges independently of each other', () => {
    const ids = evaluateBadges({ ...emptyContext, completedLessonCount: 1 }).map((b) => b.id);
    expect(ids).toEqual(['first_lesson']);
  });

  it('earns every streak threshold at or below the current streak', () => {
    const ids = evaluateBadges({ ...emptyContext, currentStreak: 7 }).map((b) => b.id);
    expect(ids).toEqual(['streak_3', 'streak_7']);
  });

  it('earns every level threshold at or below the current level', () => {
    const ids = evaluateBadges({ ...emptyContext, level: 10 }).map((b) => b.id);
    expect(ids).toEqual(['level_5', 'level_10']);
  });

  it('earns everything at once for a maxed-out context', () => {
    const maxed = {
      completedLessonCount: 5,
      completedLabCount: 5,
      correctQuestionCount: 5,
      submittedSimulationCount: 5,
      passedSimulationCount: 5,
      currentStreak: 30,
      level: 10,
    };
    expect(evaluateBadges(maxed)).toHaveLength(BADGE_CATALOG.length);
  });
});
