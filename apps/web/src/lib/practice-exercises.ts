import type { PracticeFlashcard, PracticeMaterial } from './practice';

// Limits that keep a session short (a lesson part is a few minutes of reading,
// its practice should be too).
const MAX_FLASHCARDS = 5;
const MAX_QUESTIONS = 5;
const MAX_MATCH_PAIRS = 4;
const OPTION_COUNT = 4;

export const JUDGE_RIGHT = 'Certo';
export const JUDGE_WRONG = 'Errado';

export type Exercise =
  // Concept front shown, pick its answer among near misses written for that
  // card. The first exercise for each flashcard is marked `isNew`
  // (Duolingo's "new word").
  | {
      kind: 'definition';
      key: string;
      flashcardId: string;
      isNew: boolean;
      prompt: string;
      options: string[];
      answer: string;
    }
  // Front plus one candidate answer — the real one or a near miss — to judge.
  | {
      kind: 'judge';
      key: string;
      flashcardId: string;
      prompt: string;
      statement: string;
      options: string[];
      answer: string;
      // The real answer, shown after a "this is wrong" statement.
      correctText: string;
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

/**
 * Wrong options for a card: its own near misses first. Cards seeded before
 * distractors existed fall back to other cards' answers, skipping any text
 * already used in this session so the same wrong option doesn't keep coming
 * back (and an answer learned earlier can't be ruled out by elimination).
 */
function wrongOptions(card: PracticeFlashcard, pool: string[], used: Set<string>): string[] {
  const own = card.distractors.filter((text) => text !== card.back);
  const borrowed = shuffle(pool.filter((text) => text !== card.back && !used.has(text)));
  const picked = [...shuffle(own), ...borrowed].slice(0, OPTION_COUNT - 1);
  picked.forEach((text) => used.add(text));
  return picked;
}

/**
 * Builds a Duolingo-style session from a lesson's practice material: each
 * concept is introduced by picking its answer among near misses, interleaved
 * with the lesson's questions, then reviewed with a "match the pairs" round
 * and a "right or wrong?" judgement per concept.
 */
export function buildExercises(material: PracticeMaterial): Exercise[] {
  const flashcards = material.flashcards.slice(0, MAX_FLASHCARDS);
  const questions = material.questions.slice(0, MAX_QUESTIONS);
  const pool = [...material.flashcards, ...material.otherFlashcards].map((card) => card.back);
  const used = new Set(flashcards.map((card) => card.back));

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

  flashcards.forEach((card, index) => {
    exercises.push({
      kind: 'definition',
      key: `d-${card.id}`,
      flashcardId: card.id,
      isNew: true,
      prompt: card.front,
      options: shuffle([card.back, ...wrongOptions(card, pool, used)]),
      answer: card.back,
    });
    if (index < questions.length) {
      exercises.push(questionExercise(index));
    }
  });

  for (let index = flashcards.length; index < questions.length; index++) {
    exercises.push(questionExercise(index));
  }

  if (flashcards.length >= 3) {
    exercises.push({
      kind: 'match',
      key: 'm-1',
      pairs: shuffle(flashcards)
        .slice(0, MAX_MATCH_PAIRS)
        .map((card) => ({ id: card.id, left: card.front, right: card.back })),
    });
  }

  for (const card of shuffle(flashcards)) {
    const nearMisses = card.distractors.filter((text) => text !== card.back);
    // Without near misses a "wrong" statement would be another card's answer,
    // which gives itself away.
    const isRight = nearMisses.length === 0 || Math.random() < 0.5;
    exercises.push({
      kind: 'judge',
      key: `j-${card.id}`,
      flashcardId: card.id,
      prompt: card.front,
      statement: isRight ? card.back : shuffle(nearMisses)[0],
      options: [JUDGE_RIGHT, JUDGE_WRONG],
      answer: isRight ? JUDGE_RIGHT : JUDGE_WRONG,
      correctText: card.back,
    });
  }

  return exercises;
}
