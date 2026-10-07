import { describe, expect, it } from 'vitest';
import { assignToLessons } from './lesson-assignment.js';

describe('assignToLessons', () => {
  const lessons = [
    '## Fanout\n\nPublicar num tópico SNS com uma fila SQS por consumidor. Coreografia com EventBridge.',
    '## Retry\n\nBackoff exponencial com jitter. Dead-letter queue com maxReceiveCount. Idempotência.',
  ];

  it('puts every item in the only lesson of a single-lesson topic', () => {
    expect(
      assignToLessons(['qualquer coisa', 'outra'], ['## Única lição']),
    ).toEqual([0, 0]);
  });

  it('assigns each item to the lesson that shares its distinctive words', () => {
    const items = [
      'Como entregar o mesmo evento a vários consumidores? Tópico SNS com fila SQS por consumidor (fanout).',
      'Qual estratégia de retry? Backoff exponencial com jitter.',
      'Quando a mensagem vai para a dead-letter queue? Ao passar do maxReceiveCount.',
    ];
    expect(assignToLessons(items, lessons)).toEqual([0, 1, 1]);
  });

  it('gives an empty lesson the item that fits it best', () => {
    const items = [
      'Backoff exponencial com jitter.',
      'Dead-letter queue e maxReceiveCount, depois de publicar no SNS.',
    ];
    const assignment = assignToLessons(items, lessons);
    expect(new Set(assignment)).toEqual(new Set([0, 1]));
    expect(assignment[0]).toBe(1);
  });
});
