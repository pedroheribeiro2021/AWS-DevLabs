import { describe, expect, it } from 'vitest';
import { FlashcardState } from '@aws-devlab/database';
import { computeNextReviewAt, isDue } from './spaced-repetition.js';

const NOW = new Date('2026-10-03T12:00:00Z');
const daysLater = (days: number) => new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);

describe('computeNextReviewAt', () => {
  it('schedules by the state the review lands on', () => {
    expect(computeNextReviewAt(FlashcardState.NEW, FlashcardState.LEARNING, NOW)).toEqual(
      daysLater(1),
    );
    expect(computeNextReviewAt(FlashcardState.LEARNING, FlashcardState.REVIEW, NOW)).toEqual(
      daysLater(3),
    );
    expect(computeNextReviewAt(FlashcardState.REVIEW, FlashcardState.MASTERED, NOW)).toEqual(
      daysLater(7),
    );
  });

  it('gives a mastered card answered correctly again the longest interval', () => {
    expect(computeNextReviewAt(FlashcardState.MASTERED, FlashcardState.MASTERED, NOW)).toEqual(
      daysLater(14),
    );
  });

  it('brings a forgotten card back the next day', () => {
    expect(computeNextReviewAt(FlashcardState.MASTERED, FlashcardState.LEARNING, NOW)).toEqual(
      daysLater(1),
    );
  });
});

describe('isDue', () => {
  it('is not due when never reviewed', () => {
    expect(isDue(undefined, NOW)).toBe(false);
  });

  it('is due when reviewed before the schedule existed', () => {
    expect(isDue({ nextReviewAt: null }, NOW)).toBe(true);
  });

  it('is due once the date has come, not before', () => {
    expect(isDue({ nextReviewAt: NOW }, NOW)).toBe(true);
    expect(isDue({ nextReviewAt: daysLater(1) }, NOW)).toBe(false);
  });
});
