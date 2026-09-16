import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/lib/auth-cookies';

const PROTECTED_PATHS = ['/dashboard', '/learn', '/labs', '/questions', '/flashcards'];

export function proxy(request: NextRequest) {
  const isProtected = PROTECTED_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));

  if (!isProtected) {
    return NextResponse.next();
  }

  const hasSession =
    request.cookies.has(ACCESS_TOKEN_COOKIE) || request.cookies.has(REFRESH_TOKEN_COOKIE);

  if (!hasSession) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/learn/:path*',
    '/labs/:path*',
    '/questions/:path*',
    '/flashcards/:path*',
  ],
};
