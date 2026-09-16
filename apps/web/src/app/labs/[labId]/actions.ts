'use server';

import { revalidatePath } from 'next/cache';
import { completeLab, startLab } from '@/lib/labs';

export async function startLabAction(labId: string) {
  await startLab(labId);
  revalidatePath(`/labs/${labId}`);
  revalidatePath('/labs');
}

export async function completeLabAction(labId: string) {
  await completeLab(labId);
  revalidatePath(`/labs/${labId}`);
  revalidatePath('/labs');
}
