import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';

const PUBLIC_PATHS = ['/login'];

function encodedKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET not set');
  return new TextEncoder().encode(secret);
}

interface SessionPayload {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
}

async function decryptSession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, encodedKey(), { algorithms: ['HS256'] });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

function getJwtExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ?? null;
  } catch {
    return null;
  }
}

async function buildSessionToken(data: SessionPayload): Promise<string> {
  return new SignJWT({ ...data })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2d')
    .sign(encodedKey());
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(png|jpg|jpeg|svg|ico|css|js|woff2?)$/)
  ) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get('session')?.value;
  const session = sessionCookie ? await decryptSession(sessionCookie) : null;
  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (!session) {
    if (isPublic) return NextResponse.next();
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isPublic) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  let { accessToken } = session;
  const exp = getJwtExpiry(accessToken);
  const needsRefresh = !exp || Date.now() / 1000 > exp - 30;

  if (needsRefresh) {
    try {
      const refreshRes = await fetch(`${process.env.API_URL}/api/auth/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: session.refreshToken }),
      });

      if (!refreshRes.ok) {
        const response = NextResponse.redirect(new URL('/login', request.url));
        response.cookies.delete('session');
        return response;
      }

      const { access } = await refreshRes.json();
      accessToken = access;

      const newSessionToken = await buildSessionToken({ ...session, accessToken });
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-access-token', accessToken);

      const response = NextResponse.next({ request: { headers: requestHeaders } });
      response.cookies.set('session', newSessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 2,
      });
      return response;
    } catch {
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('session');
      return response;
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-access-token', accessToken);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
