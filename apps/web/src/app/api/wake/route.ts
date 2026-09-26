import { NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';

// Called by the auth form as soon as it mounts, so a sleeping Render free-plan
// API starts booting while the user is still typing -- instead of only when
// the login is submitted.
export async function GET() {
  try {
    await apiFetch('/health');
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
