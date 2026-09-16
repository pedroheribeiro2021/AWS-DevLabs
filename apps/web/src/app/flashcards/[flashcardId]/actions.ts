'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { reviewFlashcard } from '@/lib/flashcards';

export async function reviewFlashcardAction(flashcardId: string, correct: boolean) {
  await reviewFlashcard(flashcardId, correct);
  revalidatePath('/flashcards');
  redirect('/flashcards');
}
