'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getFlashcards, reviewFlashcard } from '@/lib/flashcards';

export async function reviewFlashcardAction(
  flashcardId: string,
  correct: boolean,
  reviewSession: boolean,
) {
  await reviewFlashcard(flashcardId, correct);
  revalidatePath('/flashcards');
  revalidatePath('/dashboard');

  if (!reviewSession) {
    redirect('/flashcards');
  }

  // Daily review goes straight to the next due card, Duolingo-style.
  const nextDue = (await getFlashcards()).find((card) => card.due && card.id !== flashcardId);
  redirect(nextDue ? `/flashcards/${nextDue.id}?review=1` : '/flashcards?review=1');
}
