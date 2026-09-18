'use server';

import { redirect } from 'next/navigation';
import { updateSimulationQuestion } from '@/lib/simulations';

export async function saveSimulationAnswer(
  attemptId: string,
  questionId: string,
  nextOrder: number | null,
  formData: FormData,
) {
  const selectedOptionIds = formData.getAll('selectedOptionIds').map(String);
  const flagged = formData.get('flagged') === 'on';

  await updateSimulationQuestion(attemptId, questionId, { selectedOptionIds, flagged });

  redirect(nextOrder ? `/simulations/${attemptId}?q=${nextOrder}` : `/simulations/${attemptId}`);
}
