import { cookies } from 'next/headers';
import { apiFetch } from './api';
import { ACCESS_TOKEN_COOKIE } from './auth-cookies';

export type QuestionType = 'KNOWLEDGE' | 'APPLICATION' | 'SCENARIO' | 'EXAM_LEVEL';
export type QuestionDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface QuestionSummary {
  id: string;
  prompt: string;
  type: QuestionType;
  difficulty: QuestionDifficulty;
  topic: { id: string; name: string };
  answered: boolean;
  isCorrect: boolean | null;
}

interface QuestionOptionBase {
  id: string;
  text: string;
  isCorrect?: boolean;
  explanation?: string;
}

export interface QuestionDetail {
  id: string;
  prompt: string;
  type: QuestionType;
  difficulty: QuestionDifficulty;
  multipleCorrect: boolean;
  topic: { id: string; name: string };
  answered: boolean;
  isCorrect?: boolean;
  selectedOptionIds?: string[];
  explanation?: string;
  officialReferences?: string;
  options: QuestionOptionBase[];
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

export function getQuestions(): Promise<QuestionSummary[]> {
  return authorizedFetch<QuestionSummary[]>('/questions');
}

export function getQuestion(questionId: string): Promise<QuestionDetail> {
  return authorizedFetch<QuestionDetail>(`/questions/${questionId}`);
}

export function submitAnswer(questionId: string, selectedOptionIds: string[]) {
  return authorizedFetch(`/questions/${questionId}/answer`, {
    method: 'POST',
    body: JSON.stringify({ selectedOptionIds }),
  });
}
