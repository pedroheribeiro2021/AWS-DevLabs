import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SimulationStatus } from '@aws-devlab/database';
import { GamificationResult, GamificationService } from '../gamification/gamification.service.js';
import { XP_SIMULATION_COMPLETED, XP_SIMULATION_PASSED_BONUS } from '../gamification/xp-amounts.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { selectSimulationQuestionIds } from './question-selection.js';
import { computeExpiresAt, isExpired, remainingSeconds } from './simulation-time.js';

const ownedAttemptInclude = {
  questions: {
    include: { question: { include: { options: true } } },
  },
} satisfies Prisma.SimulationAttemptInclude;

type OwnedSimulationAttempt = Prisma.SimulationAttemptGetPayload<{
  include: typeof ownedAttemptInclude;
}>;

@Injectable()
export class SimulationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
  ) {}

  async findAll(userId: string) {
    return this.prisma.client.simulationAttempt.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      select: {
        id: true,
        examVersionId: true,
        questionCount: true,
        durationMinutes: true,
        status: true,
        startedAt: true,
        completedAt: true,
        correctCount: true,
        scorePercent: true,
        passed: true,
      },
    });
  }

  async start(
    userId: string,
    examVersionId: string,
    questionCount?: number,
    durationMinutes?: number,
  ) {
    const existingInProgress = await this.prisma.client.simulationAttempt.findFirst({
      where: { userId, status: SimulationStatus.IN_PROGRESS },
    });

    if (existingInProgress) {
      if (isExpired(existingInProgress.startedAt, existingInProgress.durationMinutes)) {
        await this.finalize(existingInProgress.id);
      } else {
        throw new ConflictException(
          'Você já tem um simulado em andamento. Conclua-o ou aguarde o tempo esgotar antes de iniciar outro.',
        );
      }
    }

    const examVersion = await this.prisma.client.examVersion.findUnique({
      where: { id: examVersionId },
      include: {
        domains: {
          include: { topics: { include: { questions: { select: { id: true } } } } },
        },
      },
    });

    if (!examVersion) {
      throw new NotFoundException('Versão de prova não encontrada.');
    }

    const pools = examVersion.domains.map((domain) => ({
      domainId: domain.id,
      weightPercent: domain.weightPercent,
      questionIds: domain.topics.flatMap((topic) =>
        topic.questions.map((question) => question.id),
      ),
    }));

    const targetCount = questionCount ?? examVersion.questionCount;
    const selectedQuestionIds = selectSimulationQuestionIds(pools, targetCount);

    if (selectedQuestionIds.length === 0) {
      throw new BadRequestException('Não há questões cadastradas para esta versão de prova ainda.');
    }

    const attempt = await this.prisma.client.simulationAttempt.create({
      data: {
        userId,
        examVersionId,
        questionCount: selectedQuestionIds.length,
        durationMinutes: durationMinutes ?? examVersion.durationMinutes,
        questions: {
          create: selectedQuestionIds.map((questionId, index) => ({
            questionId,
            order: index + 1,
          })),
        },
      },
      select: { id: true },
    });

    return this.findOne(attempt.id, userId);
  }

  async findOne(attemptId: string, userId: string) {
    const attempt = await this.getOwnedAttempt(attemptId, userId);
    const inProgress = attempt.status === SimulationStatus.IN_PROGRESS;

    return {
      id: attempt.id,
      examVersionId: attempt.examVersionId,
      status: attempt.status,
      startedAt: attempt.startedAt,
      durationMinutes: attempt.durationMinutes,
      remainingSeconds: inProgress
        ? remainingSeconds(attempt.startedAt, attempt.durationMinutes)
        : 0,
      expiresAt: computeExpiresAt(attempt.startedAt, attempt.durationMinutes),
      correctCount: attempt.correctCount,
      scorePercent: attempt.scorePercent,
      passed: attempt.passed,
      questions: [...attempt.questions]
        .sort((a, b) => a.order - b.order)
        .map((simulationQuestion) => ({
          id: simulationQuestion.id,
          order: simulationQuestion.order,
          flagged: simulationQuestion.flagged,
          answered: simulationQuestion.selectedOptionIds.length > 0,
          selectedOptionIds: simulationQuestion.selectedOptionIds,
          question: {
            id: simulationQuestion.question.id,
            prompt: simulationQuestion.question.prompt,
            multipleCorrect: simulationQuestion.question.multipleCorrect,
            options: [...simulationQuestion.question.options]
              .sort((a, b) => a.order - b.order)
              .map((option) => ({
                id: option.id,
                text: option.text,
              })),
          },
        })),
    };
  }

  async updateQuestion(
    attemptId: string,
    questionId: string,
    userId: string,
    selectedOptionIds: string[] | undefined,
    flagged: boolean | undefined,
  ) {
    const attempt = await this.getOwnedAttempt(attemptId, userId);

    if (attempt.status !== SimulationStatus.IN_PROGRESS) {
      throw new BadRequestException('Este simulado já foi encerrado.');
    }

    const simulationQuestion = attempt.questions.find((item) => item.questionId === questionId);
    if (!simulationQuestion) {
      throw new NotFoundException('Questão não encontrada neste simulado.');
    }

    await this.prisma.client.simulationQuestion.update({
      where: { id: simulationQuestion.id },
      data: {
        ...(selectedOptionIds !== undefined ? { selectedOptionIds } : {}),
        ...(flagged !== undefined ? { flagged } : {}),
      },
    });

    return this.findOne(attemptId, userId);
  }

  async submit(attemptId: string, userId: string) {
    const attempt = await this.getOwnedAttempt(attemptId, userId);

    let gamification: GamificationResult | null = null;
    if (attempt.status === SimulationStatus.IN_PROGRESS) {
      gamification = await this.finalize(attempt.id);
    }

    const review = await this.review(attemptId, userId);
    return { ...review, gamification };
  }

  async review(attemptId: string, userId: string) {
    const attempt = await this.getOwnedAttempt(attemptId, userId);

    if (attempt.status === SimulationStatus.IN_PROGRESS) {
      throw new BadRequestException('Envie o simulado antes de ver a revisão.');
    }

    return {
      id: attempt.id,
      status: attempt.status,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt,
      correctCount: attempt.correctCount,
      questionCount: attempt.questionCount,
      scorePercent: attempt.scorePercent,
      passed: attempt.passed,
      questions: [...attempt.questions]
        .sort((a, b) => a.order - b.order)
        .map((simulationQuestion) => ({
          id: simulationQuestion.id,
          order: simulationQuestion.order,
          isCorrect: simulationQuestion.isCorrect,
          selectedOptionIds: simulationQuestion.selectedOptionIds,
          question: {
            id: simulationQuestion.question.id,
            prompt: simulationQuestion.question.prompt,
            explanation: simulationQuestion.question.explanation,
            options: [...simulationQuestion.question.options]
              .sort((a, b) => a.order - b.order)
              .map((option) => ({
                id: option.id,
                text: option.text,
                isCorrect: option.isCorrect,
                explanation: option.explanation,
              })),
          },
        })),
    };
  }

  /**
   * Fetches an attempt scoped to its owner, transparently applying lazy
   * expiry first: every read/write path goes through here, so a
   * still-IN_PROGRESS-but-past-its-deadline attempt is always graded and
   * flipped to COMPLETED before any caller sees it -- no cron job needed.
   */
  private async getOwnedAttempt(
    attemptId: string,
    userId: string,
  ): Promise<OwnedSimulationAttempt> {
    const attempt = await this.prisma.client.simulationAttempt.findUnique({
      where: { id: attemptId },
      include: ownedAttemptInclude,
    });

    if (!attempt || attempt.userId !== userId) {
      throw new NotFoundException('Simulado não encontrado.');
    }

    if (
      attempt.status === SimulationStatus.IN_PROGRESS &&
      isExpired(attempt.startedAt, attempt.durationMinutes)
    ) {
      await this.finalize(attempt.id);
      return this.getOwnedAttempt(attemptId, userId);
    }

    return attempt;
  }

  private async finalize(attemptId: string): Promise<GamificationResult | null> {
    const attempt = await this.prisma.client.simulationAttempt.findUnique({
      where: { id: attemptId },
      include: ownedAttemptInclude,
    });

    if (!attempt || attempt.status !== SimulationStatus.IN_PROGRESS) {
      return null;
    }

    let correctCount = 0;

    for (const simulationQuestion of attempt.questions) {
      const correctOptionIds = simulationQuestion.question.options
        .filter((option) => option.isCorrect)
        .map((option) => option.id)
        .sort();
      const selectedSorted = [...simulationQuestion.selectedOptionIds].sort();
      const isCorrect =
        correctOptionIds.length > 0 &&
        correctOptionIds.length === selectedSorted.length &&
        correctOptionIds.every((id, index) => id === selectedSorted[index]);

      await this.prisma.client.simulationQuestion.update({
        where: { id: simulationQuestion.id },
        data: { isCorrect },
      });

      if (isCorrect) {
        correctCount += 1;
      }
    }

    const examVersion = await this.prisma.client.examVersion.findUnique({
      where: { id: attempt.examVersionId },
      select: { passingScorePercent: true },
    });

    const scorePercent =
      attempt.questions.length > 0
        ? Math.round((correctCount / attempt.questions.length) * 100)
        : 0;
    const passed = scorePercent >= (examVersion?.passingScorePercent ?? 100);

    await this.prisma.client.simulationAttempt.update({
      where: { id: attempt.id },
      data: {
        status: SimulationStatus.COMPLETED,
        completedAt: new Date(),
        correctCount,
        scorePercent,
        passed,
      },
    });

    const xpAmount = XP_SIMULATION_COMPLETED + (passed ? XP_SIMULATION_PASSED_BONUS : 0);
    return this.gamification.awardXp(attempt.userId, xpAmount);
  }
}
