export interface LevelInfo {
  level: number;
  xpIntoLevel: number;
  xpForLevel: number;
  xpToNextLevel: number;
}

const XP_STEP = 100;

/** Cumulative XP required to reach `level` (level 1 = 0 XP). Each level costs 100 more than the last. */
export function xpToReachLevel(level: number): number {
  return (XP_STEP * (level - 1) * level) / 2;
}

export function getLevelInfo(xp: number): LevelInfo {
  let level = 1;
  while (xpToReachLevel(level + 1) <= xp) {
    level += 1;
  }

  const levelStart = xpToReachLevel(level);
  const nextLevelStart = xpToReachLevel(level + 1);

  return {
    level,
    xpIntoLevel: xp - levelStart,
    xpForLevel: nextLevelStart - levelStart,
    xpToNextLevel: nextLevelStart - xp,
  };
}
