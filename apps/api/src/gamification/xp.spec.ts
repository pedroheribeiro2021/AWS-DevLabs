import { describe, expect, it } from 'vitest';
import { getLevelInfo, xpToReachLevel } from './xp.js';

describe('xp', () => {
  it('costs 100 more XP for each level, cumulatively', () => {
    expect(xpToReachLevel(1)).toBe(0);
    expect(xpToReachLevel(2)).toBe(100);
    expect(xpToReachLevel(3)).toBe(300);
    expect(xpToReachLevel(4)).toBe(600);
    expect(xpToReachLevel(5)).toBe(1000);
  });

  it('starts everyone at level 1 with 0 XP', () => {
    expect(getLevelInfo(0)).toEqual({
      level: 1,
      xpIntoLevel: 0,
      xpForLevel: 100,
      xpToNextLevel: 100,
    });
  });

  it('stays at the current level until the next threshold is crossed', () => {
    expect(getLevelInfo(99).level).toBe(1);
    expect(getLevelInfo(100).level).toBe(2);
    expect(getLevelInfo(299).level).toBe(2);
    expect(getLevelInfo(300).level).toBe(3);
  });

  it('reports progress within the current level', () => {
    // 150 XP: level 2 starts at 100, level 3 starts at 300 -> 50 into a 200-wide level
    expect(getLevelInfo(150)).toEqual({
      level: 2,
      xpIntoLevel: 50,
      xpForLevel: 200,
      xpToNextLevel: 150,
    });
  });
});
