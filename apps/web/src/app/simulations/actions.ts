'use server';

import { redirect } from 'next/navigation';
import { startSimulation } from '@/lib/simulations';

export async function startNewSimulation(examVersionId: string) {
  const attempt = await startSimulation(examVersionId);
  redirect(`/simulations/${attempt.id}`);
}
