'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { completeLesson } from '@/lib/learning';
import { buildGamificationQuery } from '@/lib/gamification-query';

export async function markLessonComplete(lessonId: string) {
  const { gamification } = await completeLesson(lessonId);
  revalidatePath('/dashboard');
  redirect(`/learn/${lessonId}${buildGamificationQuery(gamification)}`);
}
