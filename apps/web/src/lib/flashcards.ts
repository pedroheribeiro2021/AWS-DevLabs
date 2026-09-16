import { cookies } from 'next/headers';
import { apiFetch } from './api';
import { ACCESS_TOKEN_COOKIE } from './auth-cookies';

export type FlashcardState = 'NEW' | 'LEARNING' | 'REVIEW' | 'MASTERED';

export interface FlashcardSummary {
  id: string;
  front: string;
  topic: { id: string; name: string };
  state: FlashcardState;
}

export interface FlashcardDetail {
  id: string;
  front: string;
  back: string;
  topic: { id: string; name: string };
  state: FlashcardState;
}

async function authorizedFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  return apiFetch<T>(path, {
    ...init,
    headers: {
      ...init?.headers,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });
}

export function getFlashcards(): Promise<FlashcardSummary[]> {
  return authorizedFetch<FlashcardSummary[]>('/flashcards');
}

export function getFlashcard(flashcardId: string): Promise<FlashcardDetail> {
  return authorizedFetch<FlashcardDetail>(`/flashcards/${flashcardId}`);
}

export function reviewFlashcard(flashcardId: string, correct: boolean) {
  return authorizedFetch(`/flashcards/${flashcardId}/review`, {
    method: 'POST',
    body: JSON.stringify({ correct }),
  });
}
