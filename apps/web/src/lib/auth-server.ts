import { cookies } from 'next/headers';
import { ApiError, apiFetch } from './api';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  clearAuthCookies,
  setAuthCookies,
} from './auth-cookies';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

export interface AuthFormState {
  error: string | null;
}

export function extractApiErrorMessage(error: ApiError): string {
  const body = error.body as { message?: string | string[] } | null | undefined;
  const message = Array.isArray(body?.message) ? body.message.join(' ') : body?.message;
  return message ?? 'Algo deu errado. Tente novamente.';
}

interface AuthTokensResponse {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

export async function loginOrRegister(
  path: '/auth/login' | '/auth/register',
  body: unknown,
): Promise<PublicUser> {
  const data = await apiFetch<AuthTokensResponse>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  const cookieStore = await cookies();
  setAuthCookies(cookieStore, data);

  return data.user;
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!accessToken) {
    return null;
  }

  try {
    return await apiFetch<PublicUser>('/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

/**
 * For Server Actions on long-lived client pages (the practice session) that
 * never navigate, so the proxy never gets a chance to refresh the session: on a
 * 401, swap the refresh token for new cookies and run the call once more.
 */
export async function withSessionRefresh<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) {
      throw error;
    }

    const cookieStore = await cookies();
    const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
    if (!refreshToken) {
      throw error;
    }

    const tokens = await apiFetch<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
      method: 'POST',
      headers: { Authorization: `Bearer ${refreshToken}` },
    });
    setAuthCookies(cookieStore, tokens);
    return call();
  }
}

export async function clearSession() {
  const cookieStore = await cookies();
  clearAuthCookies(cookieStore);
}
