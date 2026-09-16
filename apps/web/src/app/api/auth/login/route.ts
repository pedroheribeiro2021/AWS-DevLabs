import { NextResponse } from 'next/server';
import { ApiError } from '@/lib/api';
import { loginOrRegister } from '@/lib/auth-server';

export async function POST(request: Request) {
  const body = await request.json();

  try {
    const user = await loginOrRegister('/auth/login', body);
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(error.body, { status: error.status });
    }
    throw error;
  }
}
