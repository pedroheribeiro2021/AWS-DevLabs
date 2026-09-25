import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { BadgeDefinition } from './badges.js';
import { BadgesService, type BadgeStatus } from './badges.service.js';
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
  newBadges: BadgeDefinition[];
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

@Injectable()
export class GamificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly badges: BadgesService,
  ) {}

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

    const newBadges = await this.badges.evaluateAndAward(userId);

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
      newBadges,
    };
  }

  async getStats(userId: string): Promise<GamificationStats> {
    const [user, badges] = await Promise.all([
      this.prisma.client.user.findUniqueOrThrow({
        where: { id: userId },
        select: { xp: true, currentStreak: true, longestStreak: true },
      }),
      this.badges.getAllWithStatus(userId),
    ]);

    const levelInfo = getLevelInfo(user.xp);

    return {
      xp: user.xp,
      level: levelInfo.level,
      xpIntoLevel: levelInfo.xpIntoLevel,
      xpForLevel: levelInfo.xpForLevel,
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
      badges,
    };
  }
}
