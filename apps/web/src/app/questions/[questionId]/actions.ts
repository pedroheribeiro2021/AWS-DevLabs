'use server';

import { revalidatePath } from 'next/cache';
import { submitAnswer } from '@/lib/questions';

export async function submitQuestionAnswer(questionId: string, formData: FormData) {
  const selectedOptionIds = formData.getAll('selectedOptionIds').map(String);
  await submitAnswer(questionId, selectedOptionIds);
  revalidatePath(`/questions/${questionId}`);
  revalidatePath('/questions');
}
