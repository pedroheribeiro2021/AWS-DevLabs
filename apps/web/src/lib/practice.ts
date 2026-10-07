import { cookies } from 'next/headers';
import { apiFetch } from './api';
import { ACCESS_TOKEN_COOKIE } from './auth-cookies';
import type { LessonStatus } from './learning';

export interface PracticeQuestion {
  id: string;
  prompt: string;
  multipleCorrect: boolean;
  options: { id: string; text: string }[];
}

export interface PracticeFlashcard {
  id: string;
  front: string;
  back: string;
  // Near-miss wrong answers to the same front (empty for older cards).
  distractors: string[];
}

export interface PracticeMaterial {
  lesson: { id: string; title: string; status: LessonStatus };
  topic: { id: string; name: string };
  questions: PracticeQuestion[];
  flashcards: PracticeFlashcard[];
  // The rest of the topic's flashcards, used only as fallback wrong options.
  otherFlashcards: PracticeFlashcard[];
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

export function getPractice(lessonId: string): Promise<PracticeMaterial> {
  return authorizedFetch<PracticeMaterial>(`/learning/lessons/${lessonId}/practice`);
}
