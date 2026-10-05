import { describe, expect, it } from 'vitest';
import { sliceForLesson } from './practice-slice.js';

describe('sliceForLesson', () => {
  const items = Array.from({ length: 13 }, (_, index) => index);

  it('returns every item when the topic has a single lesson', () => {
    expect(sliceForLesson(items, 0, 1)).toEqual(items);
  });

  it('splits items into contiguous shares, earlier lessons taking the extra one', () => {
    expect(sliceForLesson(items, 0, 2)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(sliceForLesson(items, 1, 2)).toEqual([7, 8, 9, 10, 11, 12]);
  });

  it('covers every item exactly once across lessons', () => {
    const shares = [0, 1, 2].map((index) => sliceForLesson(items, index, 3));
    expect(shares.flat()).toEqual(items);
  });
});
