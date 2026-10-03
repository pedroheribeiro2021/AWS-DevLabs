'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { completeLesson } from '@/lib/learning';
import { submitAnswer } from '@/lib/questions';
import { buildGamificationQuery } from '@/lib/gamification-query';

export async function markLessonComplete(lessonId: string) {
  const { gamification } = await completeLesson(lessonId);
  revalidatePath('/dashboard');
  redirect(`/learn/${lessonId}${buildGamificationQuery(gamification)}`);
}

export async function submitCheckpointAnswer(
  lessonId: string,
  questionId: string,
  checkpointQuestionIds: string[],
  formData: FormData,
) {
  const selectedOptionIds = formData.getAll('selectedOptionIds').map(String);
  const { gamification } = await submitAnswer(questionId, selectedOptionIds);
  revalidatePath('/questions');
  revalidatePath('/dashboard');

  const gamificationQuery = buildGamificationQuery(gamification);
  const separator = gamificationQuery ? '&' : '?';
  const checkpoint = encodeURIComponent(checkpointQuestionIds.join(','));
  redirect(`/learn/${lessonId}${gamificationQuery}${separator}checkpoint=${checkpoint}#checkpoint`);
}
