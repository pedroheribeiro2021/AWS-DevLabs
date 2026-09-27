import { Injectable, NotFoundException } from '@nestjs/common';
import { FlashcardState, ProgressStatus, SimulationStatus } from '@aws-devlab/database';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  type AnswerInput,
  buildRecommendations,
  computeDomainStats,
  type DomainInput,
  findWeakTopics,
  weeklyActivity,
} from './analytics.js';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getForUser(userId: string, now = new Date()) {
    const examVersion = await this.prisma.client.examVersion.findFirst({
      where: { isCurrent: true },
      include: {
        domains: {
          orderBy: { order: 'asc' },
          include: {
            topics: {
              orderBy: { order: 'asc' },
              include: {
                lessons: { orderBy: { order: 'asc' }, select: { id: true } },
                labs: { select: { id: true } },
                questions: { select: { id: true } },
                concepts: { select: { flashcards: { select: { id: true } } } },
              },
            },
          },
        },
      },
    });

    if (!examVersion) {
      throw new NotFoundException('Nenhuma versão de prova ativa.');
    }

    const topics = examVersion.domains.flatMap((domain) => domain.topics);
    const questionTopic = new Map(
      topics.flatMap((topic) => topic.questions.map((question) => [question.id, topic.id] as const)),
    );

    const [completedLessons, labAttempts, masteredFlashcards, practiceAnswers, simulations] = await Promise.all([
      this.prisma.client.userProgress.findMany({
        where: { userId, status: ProgressStatus.COMPLETED },
        select: { lessonId: true },
      }),
      this.prisma.client.labAttempt.findMany({
        where: { userId, status: { in: [ProgressStatus.IN_PROGRESS, ProgressStatus.COMPLETED] } },
        select: { labId: true, status: true, updatedAt: true, lab: { select: { title: true } } },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.client.userFlashcardProgress.findMany({
        where: { userId, state: FlashcardState.MASTERED },
        select: { flashcardId: true },
      }),
      this.prisma.client.questionAnswer.findMany({
        where: { userId },
        select: { questionId: true, isCorrect: true, answeredAt: true },
      }),
      this.prisma.client.simulationAttempt.findMany({
        where: { userId, examVersionId: examVersion.id, status: SimulationStatus.COMPLETED },
        orderBy: { completedAt: 'asc' },
        select: {
          id: true,
          completedAt: true,
          questionCount: true,
          scorePercent: true,
          passed: true,
          questions: { select: { questionId: true, selectedOptionIds: true, isCorrect: true } },
        },
      }),
    ]);

    const completedLessonIds = new Set(completedLessons.map((progress) => progress.lessonId));
    const completedLabIds = new Set(
      labAttempts.filter((attempt) => attempt.status === ProgressStatus.COMPLETED).map((attempt) => attempt.labId),
    );
    const masteredFlashcardIds = new Set(masteredFlashcards.map((progress) => progress.flashcardId));

    const answers: AnswerInput[] = [
      ...practiceAnswers.map((answer) => ({ ...answer, topicId: questionTopic.get(answer.questionId) })),
      // Unanswered simulation questions are scored as wrong, but they say
      // nothing about what the user knows -- only count the answered ones.
      ...simulations.flatMap((simulation) =>
        simulation.questions
          .filter((question) => question.selectedOptionIds.length > 0 && question.isCorrect !== null)
          .map((question) => ({
            questionId: question.questionId,
            topicId: questionTopic.get(question.questionId),
            isCorrect: question.isCorrect!,
            answeredAt: simulation.completedAt!,
          })),
      ),
    ].filter((answer): answer is AnswerInput => answer.topicId !== undefined);

    const domainInputs: DomainInput[] = examVersion.domains.map((domain) => ({
      id: domain.id,
      name: domain.name,
      weightPercent: domain.weightPercent,
      topics: domain.topics.map((topic) => {
        const flashcardIds = topic.concepts.flatMap((concept) => concept.flashcards.map((card) => card.id));
        const nextLesson = topic.lessons.find((lesson) => !completedLessonIds.has(lesson.id)) ?? topic.lessons[0];
        return {
          id: topic.id,
          name: topic.name,
          domainId: domain.id,
          lessonsTotal: topic.lessons.length,
          lessonsCompleted: topic.lessons.filter((lesson) => completedLessonIds.has(lesson.id)).length,
          nextLessonId: nextLesson?.id ?? null,
          labsTotal: topic.labs.length,
          labsCompleted: topic.labs.filter((lab) => completedLabIds.has(lab.id)).length,
          questionsTotal: topic.questions.length,
          flashcardsTotal: flashcardIds.length,
          flashcardsMastered: flashcardIds.filter((id) => masteredFlashcardIds.has(id)).length,
        };
      }),
    }));

    const domains = computeDomainStats(domainInputs, answers);
    const answeredQuestions = domains.reduce((sum, domain) => sum + domain.answeredQuestions, 0);
    const correctQuestions = domains.reduce((sum, domain) => sum + domain.correctQuestions, 0);
    const allTopics = domains.flatMap((domain) => domain.topics);

    return {
      examVersionId: examVersion.id,
      passingScorePercent: examVersion.passingScorePercent,
      overall: {
        answeredQuestions,
        correctQuestions,
        accuracyPercent: answeredQuestions === 0 ? null : Math.round((correctQuestions / answeredQuestions) * 100),
        questionsTotal: questionTopic.size,
        totalAnswers: answers.length,
        lessonsCompleted: allTopics.reduce((sum, topic) => sum + topic.lessonsCompleted, 0),
        lessonsTotal: allTopics.reduce((sum, topic) => sum + topic.lessonsTotal, 0),
        labsCompleted: allTopics.reduce((sum, topic) => sum + topic.labsCompleted, 0),
        labsTotal: allTopics.reduce((sum, topic) => sum + topic.labsTotal, 0),
        flashcardsMastered: allTopics.reduce((sum, topic) => sum + topic.flashcardsMastered, 0),
        flashcardsTotal: allTopics.reduce((sum, topic) => sum + topic.flashcardsTotal, 0),
        simulationsCompleted: simulations.length,
      },
      domains,
      weakTopics: findWeakTopics(domains).map((topic) => ({
        id: topic.id,
        name: topic.name,
        accuracyPercent: topic.accuracyPercent,
        answeredQuestions: topic.answeredQuestions,
      })),
      recommendations: buildRecommendations({
        domains,
        inProgressLabs: labAttempts
          .filter((attempt) => attempt.status === ProgressStatus.IN_PROGRESS)
          .map((attempt) => ({ id: attempt.labId, title: attempt.lab.title })),
        completedSimulations: simulations.length,
        passingScorePercent: examVersion.passingScorePercent,
      }),
      history: {
        weekly: weeklyActivity(answers, now),
        simulations: simulations.map((simulation) => ({
          id: simulation.id,
          completedAt: simulation.completedAt,
          questionCount: simulation.questionCount,
          scorePercent: simulation.scorePercent,
          passed: simulation.passed,
        })),
      },
    };
  }
}
