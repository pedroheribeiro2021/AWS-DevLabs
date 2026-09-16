import { cookies } from 'next/headers';
import { apiFetch } from './api';
import { ACCESS_TOKEN_COOKIE } from './auth-cookies';

export type LessonStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export interface TrackLesson {
  id: string;
  title: string;
  order: number;
  estimatedMinutes: number;
  status: LessonStatus;
}

export interface TrackTopic {
  id: string;
  name: string;
  lessons: TrackLesson[];
}

export interface TrackDomain {
  id: string;
  name: string;
  weightPercent: number;
  topics: TrackTopic[];
}

export interface Track {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  examVersions: { code: string; domains: TrackDomain[] }[];
}

export interface LessonDetail {
  id: string;
  title: string;
  content: string;
  estimatedMinutes: number;
  status: LessonStatus;
  topic: { id: string; name: string };
  certification: { slug: string; name: string };
  resources: { id: string; title: string; url: string; type: string }[];
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

export function getTrack(certificationSlug: string): Promise<Track> {
  return authorizedFetch<Track>(`/learning/track/${certificationSlug}`);
}

export function getLesson(lessonId: string): Promise<LessonDetail> {
  return authorizedFetch<LessonDetail>(`/learning/lessons/${lessonId}`);
}

export function completeLesson(lessonId: string) {
  return authorizedFetch(`/learning/lessons/${lessonId}/complete`, { method: 'POST' });
}
