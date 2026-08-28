import { NextResponse } from 'next/server';
import { SESSION_COOKIE, sessionCookieOptionsFor } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  // Keep this relative: inside Docker, request.url can use the bind address
  // (0.0.0.0) instead of the hostname the browser used.
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: '/login' },
  });

  // Expire the cookie with the same attributes used when it was created.
  // An explicit expiry is more reliable across proxies than delete(), which
  // may otherwise produce a cookie that does not match the original path.
  response.cookies.set(SESSION_COOKIE, '', {
    ...sessionCookieOptionsFor(request.headers),
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}
