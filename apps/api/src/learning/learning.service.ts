import { NotFoundException } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { ProgressStatus } from '@aws-devlab/database';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class LearningService {
  constructor(private readonly prisma: PrismaService) {}

  async getTrack(certificationSlug: string, userId: string) {
    const certification = await this.prisma.client.certification.findUnique({
      where: { slug: certificationSlug },
      include: {
        examVersions: {
          where: { isCurrent: true },
          include: {
            domains: {
              orderBy: { order: 'asc' },
              include: {
                topics: {
                  orderBy: { order: 'asc' },
                  include: {
                    lessons: {
                      orderBy: { order: 'asc' },
                      select: { id: true, title: true, order: true, estimatedMinutes: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!certification) {
      throw new NotFoundException('Certificação não encontrada.');
    }

    const lessonIds = certification.examVersions
      .flatMap((examVersion) => examVersion.domains)
      .flatMap((domain) => domain.topics)
      .flatMap((topic) => topic.lessons)
      .map((lesson) => lesson.id);

    const progressByLessonId = await this.getProgressMap(userId, lessonIds);

    return {
      id: certification.id,
      slug: certification.slug,
      name: certification.name,
      description: certification.description,
      examVersions: certification.examVersions.map((examVersion) => ({
        id: examVersion.id,
        code: examVersion.code,
        domains: examVersion.domains.map((domain) => ({
          id: domain.id,
          name: domain.name,
          weightPercent: domain.weightPercent,
          topics: domain.topics.map((topic) => ({
            id: topic.id,
            name: topic.name,
            lessons: topic.lessons.map((lesson) => ({
              ...lesson,
              status: progressByLessonId.get(lesson.id) ?? ProgressStatus.NOT_STARTED,
            })),
          })),
        })),
      })),
    };
  }

  async getLesson(lessonId: string, userId: string) {
    const lesson = await this.prisma.client.lesson.findUnique({
      where: { id: lessonId },
      include: {
        resources: { orderBy: { order: 'asc' } },
        topic: { include: { domain: { include: { examVersion: { include: { certification: true } } } } } },
      },
    });

    if (!lesson) {
      throw new NotFoundException('Lição não encontrada.');
    }

    const progress = await this.prisma.client.userProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    });

    const { topic, ...lessonFields } = lesson;

    return {
      ...lessonFields,
      status: progress?.status ?? ProgressStatus.NOT_STARTED,
      topic: { id: topic.id, name: topic.name },
      certification: {
        slug: topic.domain.examVersion.certification.slug,
        name: topic.domain.examVersion.certification.name,
      },
    };
  }

  async completeLesson(lessonId: string, userId: string) {
    const lesson = await this.prisma.client.lesson.findUnique({ where: { id: lessonId } });

    if (!lesson) {
      throw new NotFoundException('Lição não encontrada.');
    }

    return this.prisma.client.userProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: { status: ProgressStatus.COMPLETED, completedAt: new Date() },
      create: {
        userId,
        lessonId,
        status: ProgressStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
  }

  private async getProgressMap(userId: string, lessonIds: string[]) {
    if (lessonIds.length === 0) {
      return new Map<string, ProgressStatus>();
    }

    const progress = await this.prisma.client.userProgress.findMany({
      where: { userId, lessonId: { in: lessonIds } },
      select: { lessonId: true, status: true },
    });

    return new Map(progress.map((entry) => [entry.lessonId, entry.status]));
  }
}
