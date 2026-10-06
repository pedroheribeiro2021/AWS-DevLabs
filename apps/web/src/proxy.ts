import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ApiError, apiFetch } from '@/lib/api';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, setAuthCookies } from '@/lib/auth-cookies';

const PROTECTED_PATHS = ['/dashboard', '/learn', '/labs', '/questions', '/flashcards', '/simulations', '/analytics'];

export async function proxy(request: NextRequest) {
  const isProtected = PROTECTED_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));

  if (!isProtected) {
    return NextResponse.next();
  }

  const hasAccessToken = request.cookies.has(ACCESS_TOKEN_COOKIE);
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!hasAccessToken && !refreshToken) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // The access cookie lives as long as the access token (15 min). Once it's gone,
  // trade the refresh token (7 days) for new tokens before the page renders, so an
  // active user is never sent to /login and the URL (query string included) is kept.
  if (!hasAccessToken && refreshToken) {
    try {
      const tokens = await apiFetch<{ accessToken: string; refreshToken: string }>(
        '/auth/refresh',
        { method: 'POST', headers: { Authorization: `Bearer ${refreshToken}` } },
      );

      // Forward the new tokens to this request's Server Components/Actions...
      request.cookies.set(ACCESS_TOKEN_COOKIE, tokens.accessToken);
      request.cookies.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken);
      const response = NextResponse.next({ request: { headers: request.headers } });
      // ...and store them in the browser.
      setAuthCookies(response.cookies, tokens);
      return response;
    } catch (error) {
      // Refresh token expired or revoked: fall through and let the page send the
      // user to /login. Cookies are left alone so a parallel request that did
      // refresh successfully isn't undone by this one.
      if (!(error instanceof ApiError)) {
        throw error;
      }
    }
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
    '/simulations/:path*',
    '/analytics/:path*',
  ],
};
