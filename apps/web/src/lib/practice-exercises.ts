import type { PracticeFlashcard, PracticeMaterial } from './practice';

// Limits that keep a session around Duolingo's size (~15 exercises, a few minutes).
const MAX_FLASHCARDS = 6;
const MAX_QUESTIONS = 6;
const MATCH_PAIRS = 3;

export type Exercise =
  // Concept front shown, pick its explanation. The first exercise for each
  // flashcard is marked `isNew` (Duolingo's "new word").
  | {
      kind: 'definition';
      key: string;
      flashcardId: string;
      isNew: boolean;
      prompt: string;
      options: string[];
      answer: string;
    }
  // The reverse: explanation shown, pick the concept.
  | {
      kind: 'term';
      key: string;
      flashcardId: string;
      prompt: string;
      options: string[];
      answer: string;
    }
  | {
      kind: 'match';
      key: string;
      pairs: { id: string; left: string; right: string }[];
    }
  // Graded by the API, so the correct option never reaches the browser beforehand.
  | {
      kind: 'question';
      key: string;
      questionId: string;
      prompt: string;
      multipleCorrect: boolean;
      options: { id: string; text: string }[];
    };

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickOptions(answer: string, pool: string[]): string[] {
  const distractors = shuffle([...new Set(pool)].filter((text) => text !== answer)).slice(0, 3);
  return shuffle([answer, ...distractors]);
}

/**
 * Builds a Duolingo-style session from a lesson's practice material: each
 * concept is introduced by picking its explanation, interleaved with the
 * topic's questions, with "match the pairs" rounds and reverse exercises
 * revisiting the same concepts later in the session.
 */
export function buildExercises(material: PracticeMaterial): Exercise[] {
  const flashcards = material.flashcards.slice(0, MAX_FLASHCARDS);
  const questions = material.questions.slice(0, MAX_QUESTIONS);
  const allCards: PracticeFlashcard[] = [...material.flashcards, ...material.otherFlashcards];
  const backs = allCards.map((card) => card.back);
  const fronts = allCards.map((card) => card.front);

  const exercises: Exercise[] = [];
  const questionExercise = (index: number): Exercise => {
    const question = questions[index];
    return {
      kind: 'question',
      key: `q-${question.id}`,
      questionId: question.id,
      prompt: question.prompt,
      multipleCorrect: question.multipleCorrect,
      options: question.options,
    };
  };
  const matchExercise = (cards: PracticeFlashcard[], key: string): Exercise => ({
    kind: 'match',
    key,
    pairs: cards.map((card) => ({
      id: card.id,
      left: card.front,
      right: card.back,
    })),
  });

  flashcards.forEach((card, index) => {
    exercises.push({
      kind: 'definition',
      key: `d-${card.id}`,
      flashcardId: card.id,
      isNew: true,
      prompt: card.front,
      options: pickOptions(card.back, backs),
      answer: card.back,
    });
    if (index < questions.length) {
      exercises.push(questionExercise(index));
    }
    // Review the first concepts together once they've all been introduced.
    if (index === MATCH_PAIRS - 1) {
      exercises.push(matchExercise(flashcards.slice(0, MATCH_PAIRS), 'm-1'));
    }
  });

  for (let index = flashcards.length; index < questions.length; index++) {
    exercises.push(questionExercise(index));
  }

  const laterCards = flashcards.slice(MATCH_PAIRS);
  if (laterCards.length >= 2) {
    exercises.push(matchExercise(laterCards.slice(0, MATCH_PAIRS), 'm-2'));
  }

  for (const card of shuffle(flashcards).slice(0, 2)) {
    exercises.push({
      kind: 'term',
      key: `t-${card.id}`,
      flashcardId: card.id,
      prompt: card.back,
      options: pickOptions(card.front, fronts),
      answer: card.front,
    });
  }

  return exercises;
}
