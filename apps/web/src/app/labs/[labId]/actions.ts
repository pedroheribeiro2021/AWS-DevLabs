'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { completeLab, startLab } from '@/lib/labs';
import { buildGamificationQuery } from '@/lib/gamification-query';

export async function startLabAction(labId: string) {
  await startLab(labId);
  revalidatePath(`/labs/${labId}`);
  revalidatePath('/labs');
}

export async function completeLabAction(labId: string) {
  const { gamification } = await completeLab(labId);
  revalidatePath('/labs');
  revalidatePath('/dashboard');
  redirect(`/labs/${labId}${buildGamificationQuery(gamification)}`);
}
