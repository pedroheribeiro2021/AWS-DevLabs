/**
 * Questions and flashcards belong to a topic, not to a lesson. When a topic has
 * several lessons, each item goes to the lesson whose text it shares the most
 * distinctive words with, so a lesson's practice covers what that lesson
 * teaches (splitting by stored order used to ask about the next lesson's
 * content). Words that appear in every lesson of the topic carry no weight.
 */

const STOP_WORDS = new Set(
  (
    'para como uma com que dos das nos nas por mais sem sao ser num numa cada qual quando onde ' +
    'entre pelo pela isso essa esse este esta aos nao sua seu suas seus ela ele elas eles tambem ' +
    'mesmo mesma outro outra outros outras sobre ate apos antes depois deve devem pode podem ' +
    'precisa fica ficam todo toda todos todas the and qualquer funcao funcoes servico servicos aws exemplo'
  ).split(' '),
);

function tokenize(text: string): string[] {
  const words =
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .match(/[a-z0-9$_.:-]{3,}/g) ?? [];
  return words
    .map((word) => word.replace(/[.:-]+$/, ''))
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
}

function countWords(words: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const word of words) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return counts;
}

/** Returns, for each item, the index of the lesson it belongs to. */
export function assignToLessons(
  itemTexts: string[],
  lessonTexts: string[],
): number[] {
  if (lessonTexts.length <= 1) {
    return itemTexts.map(() => 0);
  }

  const lessonWords = lessonTexts.map((text) => countWords(tokenize(text)));
  const documentFrequency = new Map<string, number>();
  for (const words of lessonWords) {
    for (const word of words.keys()) {
      documentFrequency.set(word, (documentFrequency.get(word) ?? 0) + 1);
    }
  }
  const weight = (word: string) =>
    Math.log(
      (lessonTexts.length + 1) / ((documentFrequency.get(word) ?? 0) + 0.5),
    );

  const scores = itemTexts.map((text) => {
    const itemWords = countWords(tokenize(text));
    return lessonWords.map((words) => {
      let score = 0;
      for (const [word, count] of itemWords) {
        const inLesson = words.get(word);
        if (inLesson) {
          score += Math.min(count, 2) * Math.log(1 + inLesson) * weight(word);
        }
      }
      return score;
    });
  });

  // Ties (including items that match nothing) go to the earliest lesson.
  const assignment = scores.map((itemScores) =>
    itemScores.indexOf(Math.max(...itemScores)),
  );

  // Every lesson gets at least one item when there are enough: an empty lesson
  // takes its best-scoring item from a lesson that has more than one.
  lessonTexts.forEach((_, lesson) => {
    if (assignment.includes(lesson)) {
      return;
    }
    const sizes = lessonTexts.map(
      (__, other) => assignment.filter((a) => a === other).length,
    );
    let best = -1;
    assignment.forEach((current, item) => {
      if (
        sizes[current] > 1 &&
        (best === -1 || scores[item][lesson] > scores[best][lesson])
      ) {
        best = item;
      }
    });
    if (best !== -1) {
      assignment[best] = lesson;
    }
  });

  return assignment;
}
