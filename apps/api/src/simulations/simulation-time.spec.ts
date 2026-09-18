import { describe, expect, it } from 'vitest';
import { computeExpiresAt, isExpired, remainingSeconds } from './simulation-time.js';

describe('simulation-time', () => {
  const startedAt = new Date('2026-01-01T10:00:00.000Z');

  it('computes expiresAt as startedAt + durationMinutes', () => {
    expect(computeExpiresAt(startedAt, 130).toISOString()).toBe('2026-01-01T12:10:00.000Z');
  });

  it('is not expired before the deadline', () => {
    const now = new Date('2026-01-01T11:00:00.000Z');
    expect(isExpired(startedAt, 130, now)).toBe(false);
  });

  it('is expired exactly at and after the deadline', () => {
    const atDeadline = new Date('2026-01-01T12:10:00.000Z');
    const afterDeadline = new Date('2026-01-01T12:10:01.000Z');
    expect(isExpired(startedAt, 130, atDeadline)).toBe(true);
    expect(isExpired(startedAt, 130, afterDeadline)).toBe(true);
  });

  it('computes remaining seconds down to zero, never negative', () => {
    const halfway = new Date('2026-01-01T11:05:00.000Z');
    expect(remainingSeconds(startedAt, 130, halfway)).toBe(65 * 60);

    const wayPast = new Date('2026-01-02T00:00:00.000Z');
    expect(remainingSeconds(startedAt, 130, wayPast)).toBe(0);
  });
});
