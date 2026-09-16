import { Injectable, NotFoundException } from '@nestjs/common';
import type { QuestionDifficulty, QuestionType } from '@aws-devlab/database';
import { PrismaService } from '../prisma/prisma.service.js';

interface FindAllFilters {
  difficulty?: QuestionDifficulty;
  type?: QuestionType;
}

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, filters: FindAllFilters) {
    const questions = await this.prisma.client.question.findMany({
      where: {
        difficulty: filters.difficulty,
        type: filters.type,
      },
      orderBy: [{ difficulty: 'asc' }, { order: 'asc' }],
      include: { topic: { select: { id: true, name: true } } },
    });

    const answers = await this.prisma.client.questionAnswer.findMany({
      where: { userId, questionId: { in: questions.map((question) => question.id) } },
      orderBy: { answeredAt: 'desc' },
      select: { questionId: true, isCorrect: true },
    });
    const latestByQuestionId = new Map<string, boolean>();
    for (const answer of answers) {
      if (!latestByQuestionId.has(answer.questionId)) {
        latestByQuestionId.set(answer.questionId, answer.isCorrect);
      }
    }

    return questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      type: question.type,
      difficulty: question.difficulty,
      topic: question.topic,
      answered: latestByQuestionId.has(question.id),
      isCorrect: latestByQuestionId.get(question.id) ?? null,
    }));
  }

  async findOne(questionId: string, userId: string) {
    const question = await this.prisma.client.question.findUnique({
      where: { id: questionId },
      include: {
        options: { orderBy: { order: 'asc' } },
        topic: { select: { id: true, name: true } },
      },
    });

    if (!question) {
      throw new NotFoundException('Questão não encontrada.');
    }

    const latestAnswer = await this.prisma.client.questionAnswer.findFirst({
      where: { questionId, userId },
      orderBy: { answeredAt: 'desc' },
    });

    const base = {
      id: question.id,
      prompt: question.prompt,
      type: question.type,
      difficulty: question.difficulty,
      multipleCorrect: question.multipleCorrect,
      topic: question.topic,
    };

    if (!latestAnswer) {
      return {
        ...base,
        answered: false,
        options: question.options.map((option) => ({ id: option.id, text: option.text })),
      };
    }

    return {
      ...base,
      answered: true,
      isCorrect: latestAnswer.isCorrect,
      selectedOptionIds: latestAnswer.selectedOptionIds,
      explanation: question.explanation,
      officialReferences: question.officialReferences,
      options: question.options.map((option) => ({
        id: option.id,
        text: option.text,
        isCorrect: option.isCorrect,
        explanation: option.explanation,
      })),
    };
  }

  async submitAnswer(questionId: string, userId: string, selectedOptionIds: string[]) {
    const question = await this.prisma.client.question.findUnique({
      where: { id: questionId },
      include: { options: true },
    });

    if (!question) {
      throw new NotFoundException('Questão não encontrada.');
    }

    const correctOptionIds = question.options
      .filter((option) => option.isCorrect)
      .map((option) => option.id)
      .sort();
    const selectedSorted = [...selectedOptionIds].sort();
    const isCorrect =
      correctOptionIds.length === selectedSorted.length &&
      correctOptionIds.every((id, index) => id === selectedSorted[index]);

    await this.prisma.client.questionAnswer.create({
      data: { userId, questionId, selectedOptionIds, isCorrect },
    });

    return this.findOne(questionId, userId);
  }
}
