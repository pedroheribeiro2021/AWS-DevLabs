export function computeExpiresAt(startedAt: Date, durationMinutes: number): Date {
  return new Date(startedAt.getTime() + durationMinutes * 60_000);
}

export function isExpired(startedAt: Date, durationMinutes: number, now: Date = new Date()): boolean {
  return now.getTime() >= computeExpiresAt(startedAt, durationMinutes).getTime();
}

export function remainingSeconds(
  startedAt: Date,
  durationMinutes: number,
  now: Date = new Date(),
): number {
  const remainingMs = computeExpiresAt(startedAt, durationMinutes).getTime() - now.getTime();
  return Math.max(0, Math.round(remainingMs / 1000));
}
