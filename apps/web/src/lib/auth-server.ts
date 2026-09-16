import { cookies } from 'next/headers';
import { ApiError, apiFetch } from './api';
import { ACCESS_TOKEN_COOKIE, clearAuthCookies, setAuthCookies } from './auth-cookies';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
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

export async function clearSession() {
  const cookieStore = await cookies();
  clearAuthCookies(cookieStore);
}
