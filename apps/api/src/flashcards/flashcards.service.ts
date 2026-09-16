import { Injectable, NotFoundException } from '@nestjs/common';
import { FlashcardState } from '@aws-devlab/database';
import { PrismaService } from '../prisma/prisma.service.js';

const STATE_ORDER: FlashcardState[] = [
  FlashcardState.NEW,
  FlashcardState.LEARNING,
  FlashcardState.REVIEW,
  FlashcardState.MASTERED,
];

@Injectable()
export class FlashcardsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    const flashcards = await this.prisma.client.flashcard.findMany({
      orderBy: { order: 'asc' },
      include: { concept: { include: { topic: { select: { id: true, name: true } } } } },
    });

    const progress = await this.prisma.client.userFlashcardProgress.findMany({
      where: { userId, flashcardId: { in: flashcards.map((card) => card.id) } },
      select: { flashcardId: true, state: true },
    });
    const stateByFlashcardId = new Map(progress.map((entry) => [entry.flashcardId, entry.state]));

    return flashcards.map((card) => ({
      id: card.id,
      front: card.front,
      topic: card.concept.topic,
      state: stateByFlashcardId.get(card.id) ?? FlashcardState.NEW,
    }));
  }

  async findOne(flashcardId: string, userId: string) {
    const flashcard = await this.prisma.client.flashcard.findUnique({
      where: { id: flashcardId },
      include: { concept: { include: { topic: { select: { id: true, name: true } } } } },
    });

    if (!flashcard) {
      throw new NotFoundException('Flashcard não encontrado.');
    }

    const progress = await this.prisma.client.userFlashcardProgress.findUnique({
      where: { userId_flashcardId: { userId, flashcardId } },
    });

    return {
      id: flashcard.id,
      front: flashcard.front,
      back: flashcard.back,
      topic: flashcard.concept.topic,
      state: progress?.state ?? FlashcardState.NEW,
    };
  }

  async review(flashcardId: string, userId: string, correct: boolean) {
    const flashcard = await this.prisma.client.flashcard.findUnique({
      where: { id: flashcardId },
    });

    if (!flashcard) {
      throw new NotFoundException('Flashcard não encontrado.');
    }

    const current = await this.prisma.client.userFlashcardProgress.findUnique({
      where: { userId_flashcardId: { userId, flashcardId } },
    });

    const currentState = current?.state ?? FlashcardState.NEW;
    const nextState = correct
      ? STATE_ORDER[Math.min(STATE_ORDER.indexOf(currentState) + 1, STATE_ORDER.length - 1)]
      : FlashcardState.LEARNING;

    return this.prisma.client.userFlashcardProgress.upsert({
      where: { userId_flashcardId: { userId, flashcardId } },
      update: { state: nextState, lastReviewedAt: new Date() },
      create: { userId, flashcardId, state: nextState, lastReviewedAt: new Date() },
    });
  }
}
