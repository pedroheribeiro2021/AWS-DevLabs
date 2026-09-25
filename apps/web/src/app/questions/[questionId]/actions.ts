'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { submitAnswer } from '@/lib/questions';
import { buildGamificationQuery } from '@/lib/gamification-query';

export async function submitQuestionAnswer(questionId: string, formData: FormData) {
  const selectedOptionIds = formData.getAll('selectedOptionIds').map(String);
  const { gamification } = await submitAnswer(questionId, selectedOptionIds);
  revalidatePath('/questions');
  redirect(`/questions/${questionId}${buildGamificationQuery(gamification)}`);
}
