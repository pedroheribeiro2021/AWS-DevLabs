import { FlashcardState } from '@aws-devlab/database';

const DAY_MS = 24 * 60 * 60 * 1000;

// Leitner-style boxes keyed by the state a review lands on. A wrong answer drops
// back to LEARNING (1 day); a correct answer on an already-MASTERED card gets the
// longest interval.
const INTERVAL_DAYS: Record<FlashcardState, number> = {
  [FlashcardState.NEW]: 0,
  [FlashcardState.LEARNING]: 1,
  [FlashcardState.REVIEW]: 3,
  [FlashcardState.MASTERED]: 7,
};
const MASTERED_AGAIN_DAYS = 14;

export function computeNextReviewAt(
  previousState: FlashcardState,
  nextState: FlashcardState,
  now: Date,
): Date {
  const days =
    previousState === FlashcardState.MASTERED && nextState === FlashcardState.MASTERED
      ? MASTERED_AGAIN_DAYS
      : INTERVAL_DAYS[nextState];
  return new Date(now.getTime() + days * DAY_MS);
}

// A card is due once it has been reviewed at least once and its date has come.
// Never-reviewed cards aren't "due" — they're new material, not review.
export function isDue(
  progress: { nextReviewAt: Date | null } | undefined,
  now: Date,
): boolean {
  if (!progress) {
    return false;
  }
  return progress.nextReviewAt === null || progress.nextReviewAt <= now;
}
