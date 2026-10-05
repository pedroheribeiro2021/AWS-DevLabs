/**
 * Questions and flashcards belong to a topic, not to a lesson. When a topic has
 * several lessons, each lesson's practice session gets its own contiguous share
 * of the topic's items (in their stored order), so the sessions don't repeat
 * each other. Earlier lessons take the extra item when the split is uneven.
 */
export function sliceForLesson<T>(items: T[], lessonIndex: number, lessonCount: number): T[] {
  if (lessonCount <= 1) {
    return items;
  }

  const base = Math.floor(items.length / lessonCount);
  const remainder = items.length % lessonCount;
  const start = lessonIndex * base + Math.min(lessonIndex, remainder);
  const size = base + (lessonIndex < remainder ? 1 : 0);
  return items.slice(start, start + size);
}
