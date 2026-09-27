import { describe, expect, it } from 'vitest';
import {
  type AnswerInput,
  buildRecommendations,
  computeDomainStats,
  type DomainInput,
  findWeakTopics,
  type TopicInput,
  weeklyActivity,
} from './analytics.js';

function topic(overrides: Partial<TopicInput> & { id: string }): TopicInput {
  return {
    name: `Tópico ${overrides.id}`,
    domainId: 'd1',
    lessonsTotal: 2,
    lessonsCompleted: 2,
    nextLessonId: `lesson-${overrides.id}`,
    labsTotal: 1,
    labsCompleted: 0,
    questionsTotal: 10,
    flashcardsTotal: 5,
    flashcardsMastered: 0,
    ...overrides,
  };
}

function answer(questionId: string, topicId: string, isCorrect: boolean, iso = '2026-09-20T12:00:00Z'): AnswerInput {
  return { questionId, topicId, isCorrect, answeredAt: new Date(iso) };
}

/** `correct` right and `wrong` wrong answers to distinct questions of a topic. */
function answers(topicId: string, correct: number, wrong: number): AnswerInput[] {
  return [
    ...Array.from({ length: correct }, (_, i) => answer(`${topicId}-ok-${i}`, topicId, true)),
    ...Array.from({ length: wrong }, (_, i) => answer(`${topicId}-ko-${i}`, topicId, false)),
  ];
}

const baseContext = { inProgressLabs: [], completedSimulations: 0, passingScorePercent: 72 };

describe('computeDomainStats', () => {
  it('uses only the most recent answer per question', () => {
    const domains: DomainInput[] = [{ id: 'd1', name: 'D1', weightPercent: 32, topics: [topic({ id: 't1' })] }];
    const stats = computeDomainStats(domains, [
      answer('q1', 't1', false, '2026-09-01T12:00:00Z'),
      answer('q1', 't1', true, '2026-09-02T12:00:00Z'),
      answer('q2', 't1', false),
    ]);

    expect(stats[0].topics[0]).toMatchObject({ answeredQuestions: 2, correctQuestions: 1, accuracyPercent: 50 });
    expect(stats[0]).toMatchObject({ answeredQuestions: 2, correctQuestions: 1, accuracyPercent: 50 });
  });

  it('reports null accuracy when nothing was answered', () => {
    const stats = computeDomainStats([{ id: 'd1', name: 'D1', weightPercent: 32, topics: [topic({ id: 't1' })] }], []);
    expect(stats[0].accuracyPercent).toBeNull();
    expect(stats[0].topics[0].accuracyPercent).toBeNull();
  });
});

describe('findWeakTopics', () => {
  it('ignores topics with too few answers and sorts worst first, heavier domain on ties', () => {
    const domains = computeDomainStats(
      [
        { id: 'd1', name: 'D1', weightPercent: 32, topics: [topic({ id: 'a' }), topic({ id: 'b' })] },
        { id: 'd4', name: 'D4', weightPercent: 18, topics: [topic({ id: 'c', domainId: 'd4' }), topic({ id: 'd', domainId: 'd4' })] },
      ],
      [...answers('a', 1, 1), ...answers('b', 1, 3), ...answers('c', 1, 3), ...answers('d', 3, 1)],
    );

    // a: only 2 answers; b and c: 25%; d: 75% (not weak).
    expect(findWeakTopics(domains).map((t) => t.id)).toEqual(['b', 'c']);
  });
});

describe('buildRecommendations', () => {
  it('recommends the first unfinished topic to a brand-new user, and no simulation yet', () => {
    const domains = computeDomainStats(
      [{ id: 'd1', name: 'D1', weightPercent: 32, topics: [topic({ id: 't1', lessonsCompleted: 0 }), topic({ id: 't2', lessonsCompleted: 0 })] }],
      [],
    );
    const recommendations = buildRecommendations({ ...baseContext, domains });

    expect(recommendations).toEqual([
      expect.objectContaining({ kind: 'CONTINUE_LESSONS', href: '/learn/lesson-t1' }),
    ]);
  });

  it('puts weak topics first, then unfinished labs, and never repeats a topic', () => {
    const domains = computeDomainStats(
      [
        {
          id: 'd1',
          name: 'D1',
          weightPercent: 32,
          topics: [topic({ id: 'weak', lessonsCompleted: 1 }), topic({ id: 'next', lessonsCompleted: 0 })],
        },
      ],
      answers('weak', 1, 3),
    );
    const recommendations = buildRecommendations({
      ...baseContext,
      domains,
      inProgressLabs: [{ id: 'lab1', title: 'Lab 1' }],
    });

    expect(recommendations.map((r) => r.kind)).toEqual(['REVIEW_WEAK_TOPIC', 'FINISH_LAB', 'CONTINUE_LESSONS']);
    expect(recommendations[2].href).toBe('/learn/lesson-next');
  });

  it('suggests practice for studied topics with little of the bank answered', () => {
    const domains = computeDomainStats(
      [{ id: 'd1', name: 'D1', weightPercent: 32, topics: [topic({ id: 't1' })] }],
      answers('t1', 2, 0),
    );

    expect(buildRecommendations({ ...baseContext, domains })).toEqual([
      expect.objectContaining({ kind: 'PRACTICE_TOPIC', href: '/questions?topicId=t1' }),
    ]);
  });

  it('recommends a simulation only once every domain has enough answers', () => {
    const build = (d2Answers: number) =>
      buildRecommendations({
        ...baseContext,
        domains: computeDomainStats(
          [
            { id: 'd1', name: 'D1', weightPercent: 50, topics: [topic({ id: 'x', questionsTotal: 6 })] },
            { id: 'd2', name: 'D2', weightPercent: 50, topics: [topic({ id: 'y', domainId: 'd2', questionsTotal: 6 })] },
          ],
          [...answers('x', 5, 0), ...answers('y', d2Answers, 0)],
        ),
      });

    expect(build(4).some((r) => r.kind === 'TAKE_SIMULATION')).toBe(false);
    expect(build(5).find((r) => r.kind === 'TAKE_SIMULATION')).toMatchObject({
      title: 'Fazer seu primeiro simulado',
      href: '/simulations',
    });
  });
});

describe('weeklyActivity', () => {
  it('buckets every answer by Brasília-time week, oldest first', () => {
    // 2026-09-27 is a Sunday. Monday 2026-09-21 02:00 UTC is still Sunday 23:00 in
    // Brasília, so that answer belongs to the week of 2026-09-14.
    const now = new Date('2026-09-27T15:00:00Z');
    const weeks = weeklyActivity(
      [
        answer('q1', 't', true, '2026-09-21T02:00:00Z'),
        answer('q1', 't', false, '2026-09-22T12:00:00Z'),
        answer('q2', 't', true, '2026-09-27T12:00:00Z'),
        answer('q3', 't', true, '2026-01-01T12:00:00Z'),
      ],
      now,
      3,
    );

    expect(weeks).toEqual([
      { weekStart: '2026-09-07', answers: 0, correct: 0 },
      { weekStart: '2026-09-14', answers: 1, correct: 1 },
      { weekStart: '2026-09-21', answers: 2, correct: 1 },
    ]);
  });
});
