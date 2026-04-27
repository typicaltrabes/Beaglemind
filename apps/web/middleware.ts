import { getSessionCookie } from 'better-auth/cookies';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const publicPaths = [
  '/login',
  '/signup',
  '/mfa-challenge',
  '/mfa-setup',
  '/accept-invite',
  '/no-org',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth pages are public (D-07)
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // API auth routes and accept-invite are public
  if (pathname.startsWith('/api/auth') || pathname.startsWith('/api/accept-invite')) {
    return NextResponse.next();
  }

  // Lightweight edge-compatible session cookie check (D-08)
  // Full session + org validation happens server-side in requireTenantContext()
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|brand/|icons/|manifest.json|sw.js).*)'],
};
