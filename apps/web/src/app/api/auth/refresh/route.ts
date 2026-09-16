import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '@/lib/api';
import { REFRESH_TOKEN_COOKIE, setAuthCookies, clearAuthCookies } from '@/lib/auth-cookies';

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!refreshToken) {
    return NextResponse.json({ message: 'No active session' }, { status: 401 });
  }

  try {
    const tokens = await apiFetch<RefreshResponse>('/auth/refresh', {
      method: 'POST',
      headers: { Authorization: `Bearer ${refreshToken}` },
    });

    setAuthCookies(cookieStore, tokens);
    return NextResponse.json({ ok: true });
  } catch (error) {
    clearAuthCookies(cookieStore);
    if (error instanceof ApiError) {
      return NextResponse.json(error.body, { status: error.status });
    }
    throw error;
  }
}
