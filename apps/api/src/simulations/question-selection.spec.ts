import { describe, expect, it } from 'vitest';
import { selectSimulationQuestionIds } from './question-selection.js';

const fixedRandom = () => 0.5;

describe('selectSimulationQuestionIds', () => {
  it('selects the requested count when enough questions exist', () => {
    const pools = [
      { domainId: 'd1', weightPercent: 50, questionIds: ['q1', 'q2', 'q3', 'q4'] },
      { domainId: 'd2', weightPercent: 50, questionIds: ['q5', 'q6', 'q7', 'q8'] },
    ];

    const selected = selectSimulationQuestionIds(pools, 4, fixedRandom);

    expect(selected).toHaveLength(4);
    expect(new Set(selected).size).toBe(4);
  });

  it('distributes selection proportionally to domain weight', () => {
    const pools = [
      { domainId: 'heavy', weightPercent: 80, questionIds: Array.from({ length: 20 }, (_, i) => `h${i}`) },
      { domainId: 'light', weightPercent: 20, questionIds: Array.from({ length: 20 }, (_, i) => `l${i}`) },
    ];

    const selected = selectSimulationQuestionIds(pools, 10, fixedRandom);

    const heavyCount = selected.filter((id) => id.startsWith('h')).length;
    const lightCount = selected.filter((id) => id.startsWith('l')).length;

    expect(heavyCount).toBe(8);
    expect(lightCount).toBe(2);
  });

  it('caps the result to what is available when questionCount exceeds the pool (degrades gracefully)', () => {
    const pools = [{ domainId: 'only', weightPercent: 100, questionIds: ['q1', 'q2', 'q3'] }];

    const selected = selectSimulationQuestionIds(pools, 65, fixedRandom);

    expect(selected).toHaveLength(3);
    expect(new Set(selected)).toEqual(new Set(['q1', 'q2', 'q3']));
  });

  it('redistributes shortfall from a thin domain to domains with spare capacity', () => {
    const pools = [
      { domainId: 'thin', weightPercent: 50, questionIds: ['t1'] },
      { domainId: 'deep', weightPercent: 50, questionIds: Array.from({ length: 10 }, (_, i) => `d${i}`) },
    ];

    // Proportionally this asks for 5 from each domain, but "thin" only has 1 --
    // the other 4 must come from "deep" instead of being silently dropped.
    const selected = selectSimulationQuestionIds(pools, 10, fixedRandom);

    expect(selected).toHaveLength(10);
    expect(selected).toContain('t1');
  });

  it('pulls entirely from the only domain with questions when the other weighted domains are empty', () => {
    // Mirrors the real exam shape: 4 domains with real weights, but only
    // domain-1 has authored questions so far.
    const pools = [
      { domainId: 'domain-1', weightPercent: 32, questionIds: Array.from({ length: 9 }, (_, i) => `q${i}`) },
      { domainId: 'domain-2', weightPercent: 26, questionIds: [] },
      { domainId: 'domain-3', weightPercent: 24, questionIds: [] },
      { domainId: 'domain-4', weightPercent: 18, questionIds: [] },
    ];

    const selected = selectSimulationQuestionIds(pools, 6, fixedRandom);

    expect(selected).toHaveLength(6);
    expect(selected.every((id) => id.startsWith('q'))).toBe(true);
  });

  it('never selects more than requested when every domain has questions (rounding overshoot)', () => {
    // Rounding each share on its own turns 3 questions at 32/26/24/18% into
    // 1+1+1+1 = 4; the largest-remainder quotas must add up to exactly 3.
    const pools = [
      { domainId: 'domain-1', weightPercent: 32, questionIds: Array.from({ length: 10 }, (_, i) => `a${i}`) },
      { domainId: 'domain-2', weightPercent: 26, questionIds: Array.from({ length: 10 }, (_, i) => `b${i}`) },
      { domainId: 'domain-3', weightPercent: 24, questionIds: Array.from({ length: 10 }, (_, i) => `c${i}`) },
      { domainId: 'domain-4', weightPercent: 18, questionIds: Array.from({ length: 10 }, (_, i) => `d${i}`) },
    ];

    expect(selectSimulationQuestionIds(pools, 3, fixedRandom)).toHaveLength(3);
  });

  it('builds a full 65-question exam with the real domain weights', () => {
    // 32/26/24/18% of 65 is 20.8/16.9/15.6/11.7: rounded independently that
    // would be 21+17+16+12 = 66. Largest remainder gives 21+17+15+12 = 65.
    const pools = [
      { domainId: 'domain-1', weightPercent: 32, questionIds: Array.from({ length: 40 }, (_, i) => `a${i}`) },
      { domainId: 'domain-2', weightPercent: 26, questionIds: Array.from({ length: 40 }, (_, i) => `b${i}`) },
      { domainId: 'domain-3', weightPercent: 24, questionIds: Array.from({ length: 40 }, (_, i) => `c${i}`) },
      { domainId: 'domain-4', weightPercent: 18, questionIds: Array.from({ length: 40 }, (_, i) => `d${i}`) },
    ];

    const selected = selectSimulationQuestionIds(pools, 65, fixedRandom);
    const countFor = (prefix: string) => selected.filter((id) => id.startsWith(prefix)).length;

    expect(selected).toHaveLength(65);
    expect([countFor('a'), countFor('b'), countFor('c'), countFor('d')]).toEqual([21, 17, 15, 12]);
  });

  it('returns an empty array when there are no questions at all', () => {
    const selected = selectSimulationQuestionIds([], 10, fixedRandom);
    expect(selected).toEqual([]);
  });

  it('returns an empty array for a zero or negative questionCount', () => {
    const pools = [{ domainId: 'd1', weightPercent: 100, questionIds: ['q1', 'q2'] }];
    expect(selectSimulationQuestionIds(pools, 0, fixedRandom)).toEqual([]);
    expect(selectSimulationQuestionIds(pools, -5, fixedRandom)).toEqual([]);
  });
});
