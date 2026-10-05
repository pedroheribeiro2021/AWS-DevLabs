'use server';

import { revalidatePath } from 'next/cache';
import { withSessionRefresh } from '@/lib/auth-server';
import { reviewFlashcard } from '@/lib/flashcards';
import type { GamificationResult } from '@/lib/gamification';
import { completeLesson } from '@/lib/learning';
import { submitAnswer } from '@/lib/questions';

export interface PracticeAnswerResult {
  isCorrect: boolean;
  correctOptionIds: string[];
  correctOptionTexts: string[];
  explanation: string | null;
  xpAwarded: number;
}

// The practice session is a client component that keeps its own state, so these
// actions return data instead of redirecting — a redirect would restart the session.
// A session can outlive the 15-minute access token without ever navigating, so
// each call refreshes the session on a 401.

export async function checkPracticeAnswer(
  questionId: string,
  selectedOptionIds: string[],
): Promise<PracticeAnswerResult> {
  const result = await withSessionRefresh(() => submitAnswer(questionId, selectedOptionIds));
  const correctOptions = result.options.filter((option) => option.isCorrect);
  return {
    isCorrect: result.isCorrect ?? false,
    correctOptionIds: correctOptions.map((option) => option.id),
    correctOptionTexts: correctOptions.map((option) => option.text),
    explanation: result.explanation ?? null,
    xpAwarded: result.gamification?.xpAwarded ?? 0,
  };
}

// Feeds the flashcard's spaced-repetition schedule (ADR 0008) with the first
// attempt on each concept, the same as a "Lembrei"/"Não lembrei" review.
export async function recordFlashcardPractice(flashcardId: string, correct: boolean) {
  await withSessionRefresh(() => reviewFlashcard(flashcardId, correct));
}

export async function finishPractice(
  lessonId: string,
): Promise<{ gamification: GamificationResult | null }> {
  const { gamification } = await withSessionRefresh(() => completeLesson(lessonId));
  revalidatePath('/dashboard');
  return { gamification };
}
