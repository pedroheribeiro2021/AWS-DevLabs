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
