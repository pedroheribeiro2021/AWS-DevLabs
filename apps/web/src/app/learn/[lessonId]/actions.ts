'use server';

import { revalidatePath } from 'next/cache';
import { completeLesson } from '@/lib/learning';

export async function markLessonComplete(lessonId: string) {
  await completeLesson(lessonId);
  revalidatePath(`/learn/${lessonId}`);
  revalidatePath('/dashboard');
}
