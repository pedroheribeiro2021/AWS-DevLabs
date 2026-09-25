import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { updateStreak } from './streak.js';
import { getLevelInfo } from './xp.js';

export interface GamificationResult {
  xpAwarded: number;
  xp: number;
  level: number;
  leveledUp: boolean;
  xpIntoLevel: number;
  xpForLevel: number;
  currentStreak: number;
  longestStreak: number;
  streakExtended: boolean;
}

export interface GamificationStats {
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpForLevel: number;
  currentStreak: number;
  longestStreak: number;
}

@Injectable()
export class GamificationService {
  constructor(private readonly prisma: PrismaService) {}

  async awardXp(userId: string, amount: number): Promise<GamificationResult> {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: { xp: true, currentStreak: true, longestStreak: true, lastActivityDate: true },
    });

    const beforeLevel = getLevelInfo(user.xp).level;
    const newXp = user.xp + amount;
    const afterLevel = getLevelInfo(newXp);
    const streak = updateStreak(user, new Date());

    await this.prisma.client.user.update({
      where: { id: userId },
      data: {
        xp: newXp,
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        lastActivityDate: new Date(),
      },
    });

    return {
      xpAwarded: amount,
      xp: newXp,
      level: afterLevel.level,
      leveledUp: afterLevel.level > beforeLevel,
      xpIntoLevel: afterLevel.xpIntoLevel,
      xpForLevel: afterLevel.xpForLevel,
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      streakExtended: streak.streakExtended,
    };
  }

  async getStats(userId: string): Promise<GamificationStats> {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: { xp: true, currentStreak: true, longestStreak: true },
    });

    const levelInfo = getLevelInfo(user.xp);

    return {
      xp: user.xp,
      level: levelInfo.level,
      xpIntoLevel: levelInfo.xpIntoLevel,
      xpForLevel: levelInfo.xpForLevel,
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
    };
  }
}
