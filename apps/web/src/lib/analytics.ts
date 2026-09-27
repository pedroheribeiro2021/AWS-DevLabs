import { cookies } from 'next/headers';
import { apiFetch } from './api';
import { ACCESS_TOKEN_COOKIE } from './auth-cookies';

export interface TopicStats {
  id: string;
  name: string;
  lessonsTotal: number;
  lessonsCompleted: number;
  nextLessonId: string | null;
  labsTotal: number;
  labsCompleted: number;
  questionsTotal: number;
  flashcardsTotal: number;
  flashcardsMastered: number;
  answeredQuestions: number;
  correctQuestions: number;
  accuracyPercent: number | null;
}

export interface DomainStats {
  id: string;
  name: string;
  weightPercent: number;
  answeredQuestions: number;
  correctQuestions: number;
  accuracyPercent: number | null;
  questionsTotal: number;
  lessonsTotal: number;
  lessonsCompleted: number;
  topics: TopicStats[];
}

export interface Recommendation {
  kind: 'REVIEW_WEAK_TOPIC' | 'FINISH_LAB' | 'CONTINUE_LESSONS' | 'PRACTICE_TOPIC' | 'TAKE_SIMULATION';
  title: string;
  reason: string;
  href: string;
}

export interface Analytics {
  examVersionId: string;
  passingScorePercent: number;
  overall: {
    answeredQuestions: number;
    correctQuestions: number;
    accuracyPercent: number | null;
    questionsTotal: number;
    totalAnswers: number;
    lessonsCompleted: number;
    lessonsTotal: number;
    labsCompleted: number;
    labsTotal: number;
    flashcardsMastered: number;
    flashcardsTotal: number;
    simulationsCompleted: number;
  };
  domains: DomainStats[];
  weakTopics: { id: string; name: string; accuracyPercent: number; answeredQuestions: number }[];
  recommendations: Recommendation[];
  history: {
    weekly: { weekStart: string; answers: number; correct: number }[];
    simulations: {
      id: string;
      completedAt: string;
      questionCount: number;
      scorePercent: number;
      passed: boolean;
    }[];
  };
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

export function getAnalytics(): Promise<Analytics> {
  return authorizedFetch<Analytics>('/analytics/me');
}
