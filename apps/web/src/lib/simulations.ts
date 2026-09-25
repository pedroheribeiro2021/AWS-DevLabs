import { cookies } from 'next/headers';
import { apiFetch } from './api';
import { ACCESS_TOKEN_COOKIE } from './auth-cookies';
import type { GamificationResult } from './gamification';

export type SimulationStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';

export interface SimulationSummary {
  id: string;
  examVersionId: string;
  questionCount: number;
  durationMinutes: number;
  status: SimulationStatus;
  startedAt: string;
  completedAt: string | null;
  correctCount: number | null;
  scorePercent: number | null;
  passed: boolean | null;
}

interface SimulationOptionBase {
  id: string;
  text: string;
  isCorrect?: boolean;
  explanation?: string;
}

export interface SimulationQuestionState {
  id: string;
  order: number;
  flagged: boolean;
  answered: boolean;
  selectedOptionIds: string[];
  isCorrect?: boolean;
  question: {
    id: string;
    prompt: string;
    explanation?: string;
    multipleCorrect?: boolean;
    options: SimulationOptionBase[];
  };
}

export interface SimulationDetail {
  id: string;
  examVersionId: string;
  status: SimulationStatus;
  startedAt: string;
  durationMinutes: number;
  remainingSeconds: number;
  expiresAt: string;
  correctCount: number | null;
  scorePercent: number | null;
  passed: boolean | null;
  questions: SimulationQuestionState[];
}

export interface SimulationReview {
  id: string;
  status: SimulationStatus;
  startedAt: string;
  completedAt: string | null;
  correctCount: number | null;
  questionCount: number;
  scorePercent: number | null;
  passed: boolean | null;
  questions: SimulationQuestionState[];
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

export function getSimulations(): Promise<SimulationSummary[]> {
  return authorizedFetch<SimulationSummary[]>('/simulations');
}

export function getSimulation(id: string): Promise<SimulationDetail> {
  return authorizedFetch<SimulationDetail>(`/simulations/${id}`);
}

export function getSimulationReview(id: string): Promise<SimulationReview> {
  return authorizedFetch<SimulationReview>(`/simulations/${id}/review`);
}

export function startSimulation(examVersionId: string): Promise<SimulationDetail> {
  return authorizedFetch<SimulationDetail>('/simulations/start', {
    method: 'POST',
    body: JSON.stringify({ examVersionId }),
  });
}

export function updateSimulationQuestion(
  attemptId: string,
  questionId: string,
  body: { selectedOptionIds?: string[]; flagged?: boolean },
): Promise<SimulationDetail> {
  return authorizedFetch<SimulationDetail>(`/simulations/${attemptId}/questions/${questionId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function submitSimulation(
  attemptId: string,
): Promise<SimulationReview & { gamification: GamificationResult | null }> {
  return authorizedFetch(`/simulations/${attemptId}/submit`, {
    method: 'POST',
  });
}
