import { cookies } from 'next/headers';
import { apiFetch } from './api';
import { ACCESS_TOKEN_COOKIE } from './auth-cookies';

export type LabStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export interface LabSummary {
  id: string;
  title: string;
  level: number;
  estimatedMinutes: number;
  topic: { id: string; name: string };
  status: LabStatus;
}

export interface LabStep {
  id: string;
  order: number;
  title: string;
  instructions: string;
  validation: string;
}

export interface LabDetail {
  id: string;
  title: string;
  level: number;
  estimatedMinutes: number;
  objective: string;
  prerequisites: string;
  context: string;
  troubleshooting: string;
  cleanup: string;
  costWarning: string;
  status: LabStatus;
  topic: { id: string; name: string };
  steps: LabStep[];
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

export function getLabs(): Promise<LabSummary[]> {
  return authorizedFetch<LabSummary[]>('/labs');
}

export function getLab(labId: string): Promise<LabDetail> {
  return authorizedFetch<LabDetail>(`/labs/${labId}`);
}

export function startLab(labId: string) {
  return authorizedFetch(`/labs/${labId}/start`, { method: 'POST' });
}

export function completeLab(labId: string) {
  return authorizedFetch(`/labs/${labId}/complete`, { method: 'POST' });
}
