'use server';

import { redirect } from 'next/navigation';
import { submitSimulation } from '@/lib/simulations';

export async function confirmSubmitSimulation(attemptId: string) {
  await submitSimulation(attemptId);
  redirect(`/simulations/${attemptId}/review`);
}
