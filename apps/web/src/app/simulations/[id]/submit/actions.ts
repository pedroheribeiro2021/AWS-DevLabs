'use server';

import { redirect } from 'next/navigation';
import { submitSimulation } from '@/lib/simulations';
import { buildGamificationQuery } from '@/lib/gamification-query';

export async function confirmSubmitSimulation(attemptId: string) {
  const { gamification } = await submitSimulation(attemptId);
  redirect(`/simulations/${attemptId}/review${buildGamificationQuery(gamification)}`);
}
