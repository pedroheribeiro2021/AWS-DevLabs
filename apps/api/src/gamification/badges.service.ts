import { Injectable } from '@nestjs/common';
import { ProgressStatus, SimulationStatus } from '@aws-devlab/database';
import { PrismaService } from '../prisma/prisma.service.js';
import { BADGE_CATALOG, evaluateBadges, type BadgeContext, type BadgeDefinition } from './badges.js';
import { getLevelInfo } from './xp.js';

export interface BadgeStatus {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedAt: Date | null;
}

@Injectable()
export class BadgesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Evaluates the full catalog against `userId`'s current state and awards any newly-earned badges. */
  async evaluateAndAward(userId: string): Promise<BadgeDefinition[]> {
    const [context, alreadyEarned] = await Promise.all([
      this.getContext(userId),
      this.prisma.client.userBadge.findMany({ where: { userId }, select: { badgeId: true } }),
    ]);

    const earnedIds = new Set(alreadyEarned.map((row) => row.badgeId));
    const newlyEarned = evaluateBadges(context).filter((badge) => !earnedIds.has(badge.id));

    if (newlyEarned.length > 0) {
      await this.prisma.client.userBadge.createMany({
        data: newlyEarned.map((badge) => ({ userId, badgeId: badge.id })),
        skipDuplicates: true,
      });
    }

    return newlyEarned;
  }

  async getAllWithStatus(userId: string): Promise<BadgeStatus[]> {
    const earned = await this.prisma.client.userBadge.findMany({ where: { userId } });
    const earnedByBadgeId = new Map(earned.map((row) => [row.badgeId, row.earnedAt]));

    return BADGE_CATALOG.map((badge) => ({
      id: badge.id,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      earned: earnedByBadgeId.has(badge.id),
      earnedAt: earnedByBadgeId.get(badge.id) ?? null,
    }));
  }

  private async getContext(userId: string): Promise<BadgeContext> {
    const [
      user,
      completedLessonCount,
      completedLabCount,
      correctQuestionCount,
      submittedSimulationCount,
      passedSimulationCount,
    ] = await Promise.all([
      this.prisma.client.user.findUniqueOrThrow({ where: { id: userId }, select: { xp: true, currentStreak: true } }),
      this.prisma.client.userProgress.count({ where: { userId, status: ProgressStatus.COMPLETED } }),
      this.prisma.client.labAttempt.count({ where: { userId, status: ProgressStatus.COMPLETED } }),
      this.prisma.client.questionAnswer.count({ where: { userId, isCorrect: true } }),
      this.prisma.client.simulationAttempt.count({ where: { userId, status: SimulationStatus.COMPLETED } }),
      this.prisma.client.simulationAttempt.count({ where: { userId, status: SimulationStatus.COMPLETED, passed: true } }),
    ]);

    return {
      completedLessonCount,
      completedLabCount,
      correctQuestionCount,
      submittedSimulationCount,
      passedSimulationCount,
      currentStreak: user.currentStreak,
      level: getLevelInfo(user.xp).level,
    };
  }
}
