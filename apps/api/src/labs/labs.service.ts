import { Injectable, NotFoundException } from '@nestjs/common';
import { ProgressStatus } from '@aws-devlab/database';
import { GamificationService } from '../gamification/gamification.service.js';
import { XP_LAB_COMPLETED } from '../gamification/xp-amounts.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class LabsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
  ) {}

  async findAll(userId: string) {
    const labs = await this.prisma.client.lab.findMany({
      orderBy: [{ level: 'asc' }, { order: 'asc' }],
      include: { topic: { select: { id: true, name: true } } },
    });

    const attempts = await this.prisma.client.labAttempt.findMany({
      where: { userId, labId: { in: labs.map((lab) => lab.id) } },
      select: { labId: true, status: true },
    });
    const statusByLabId = new Map(attempts.map((attempt) => [attempt.labId, attempt.status]));

    return labs.map((lab) => ({
      id: lab.id,
      title: lab.title,
      level: lab.level,
      estimatedMinutes: lab.estimatedMinutes,
      topic: lab.topic,
      status: statusByLabId.get(lab.id) ?? ProgressStatus.NOT_STARTED,
    }));
  }

  async findOne(labId: string, userId: string) {
    const lab = await this.prisma.client.lab.findUnique({
      where: { id: labId },
      include: {
        steps: { orderBy: { order: 'asc' } },
        topic: { select: { id: true, name: true } },
      },
    });

    if (!lab) {
      throw new NotFoundException('Laboratório não encontrado.');
    }

    const attempt = await this.prisma.client.labAttempt.findUnique({
      where: { userId_labId: { userId, labId } },
    });

    return { ...lab, status: attempt?.status ?? ProgressStatus.NOT_STARTED };
  }

  async start(labId: string, userId: string) {
    await this.ensureLabExists(labId);

    return this.prisma.client.labAttempt.upsert({
      where: { userId_labId: { userId, labId } },
      update: { status: ProgressStatus.IN_PROGRESS },
      create: { userId, labId, status: ProgressStatus.IN_PROGRESS, startedAt: new Date() },
    });
  }

  async complete(labId: string, userId: string) {
    await this.ensureLabExists(labId);

    const existing = await this.prisma.client.labAttempt.findUnique({
      where: { userId_labId: { userId, labId } },
    });
    const alreadyCompleted = existing?.status === ProgressStatus.COMPLETED;

    const attempt = await this.prisma.client.labAttempt.upsert({
      where: { userId_labId: { userId, labId } },
      update: { status: ProgressStatus.COMPLETED, completedAt: new Date() },
      create: {
        userId,
        labId,
        status: ProgressStatus.COMPLETED,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });

    const gamification = alreadyCompleted
      ? null
      : await this.gamification.awardXp(userId, XP_LAB_COMPLETED);

    return { ...attempt, gamification };
  }

  private async ensureLabExists(labId: string) {
    const lab = await this.prisma.client.lab.findUnique({ where: { id: labId } });

    if (!lab) {
      throw new NotFoundException('Laboratório não encontrado.');
    }
  }
}
