'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface SimulationTimerProps {
  remainingSeconds: number;
}

export function SimulationTimer({ remainingSeconds }: SimulationTimerProps) {
  const router = useRouter();
  const [remaining, setRemaining] = useState(remainingSeconds);

  useEffect(() => {
    setRemaining(remainingSeconds);
  }, [remainingSeconds]);

  useEffect(() => {
    if (remaining <= 0) {
      // The server auto-finalizes an expired attempt on the next read, so a
      // refresh here is enough to trigger auto-submission -- no client call needed.
      router.refresh();
      return;
    }

    const timeout = setTimeout(() => setRemaining((value) => value - 1), 1000);
    return () => clearTimeout(timeout);
  }, [remaining, router]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const isLow = remaining <= 60;

  return (
    <div
      className={
        isLow
          ? 'rounded-md bg-red-50 px-3 py-1.5 font-mono text-lg font-bold text-red-600'
          : 'rounded-md bg-slate-100 px-3 py-1.5 font-mono text-lg font-bold text-slate-800'
      }
      role="timer"
      aria-live="polite"
    >
      {minutes}:{String(seconds).padStart(2, '0')}
    </div>
  );
}
