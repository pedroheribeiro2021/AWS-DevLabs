import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';
import { ACCESS_TOKEN_COOKIE } from '@/lib/auth-cookies';
import { clearSession } from '@/lib/auth-server';

export async function POST() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (accessToken) {
    await apiFetch('/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => undefined);
  }

  await clearSession();
  return NextResponse.json({ ok: true });
}
