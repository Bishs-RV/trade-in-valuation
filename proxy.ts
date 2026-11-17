import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMediaServiceProxy } from '@bishs-rv/media-service/proxy';
import { getAuthToken } from '@/app/actions/auth';
import { isBishConnectConfigured } from '@/lib/bishconnect/config';

// If Azure AD is not configured, requests pass through (MockAuthProvider handles auth)
const isAzureADConfigured = () =>
  Boolean(
    process.env.AZURE_AD_CLIENT_ID &&
      process.env.AZURE_AD_CLIENT_SECRET &&
      process.env.AZURE_AD_TENANT_ID
  );

// Must pass secret explicitly to match the fallback in authOptions
const secret = process.env.NEXTAUTH_SECRET || 'development-secret-not-for-production';

// The library proxy echoes getToken errors to the browser, so never surface the Cognito response
const getMediaToken = async () => {
  try {
    return (await getAuthToken()).access_token;
  } catch (error) {
    console.error('BishConnect token request failed:', error);
    throw new Error('BishConnect token request failed');
  }
};

const mediaProxy = createMediaServiceProxy({
  apiUrl: process.env.BISHCONNECT_API_URL ?? '',
  getToken: getMediaToken,
});

const isMediaPath = (pathname: string) =>
  pathname === '/api/media' || pathname.startsWith('/api/media/');

async function proxyMedia(request: NextRequest) {
  if (request.method === 'DELETE') {
    return NextResponse.json(
      { error: 'Deleting media is not supported' },
      { status: 405, headers: { Allow: 'GET, POST, PATCH' } }
    );
  }

  if (!isBishConnectConfigured()) {
    return NextResponse.json(
      {
        error:
          'Media service is not configured: set BISHCONNECT_API_URL, BISHCONNECT_AUTH_URL, BISHCONNECT_CLIENT_ID and BISHCONNECT_CLIENT_SECRET',
      },
      { status: 503 }
    );
  }

  // API callers get a 401, not a sign-in redirect
  if (isAzureADConfigured() && !(await getToken({ req: request, secret }))) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  return (await mediaProxy(request)) ?? NextResponse.next();
}

export async function proxy(request: NextRequest) {
  if (isMediaPath(request.nextUrl.pathname)) {
    return proxyMedia(request);
  }

  if (!isAzureADConfigured()) {
    return NextResponse.next();
  }

  // Azure AD is configured - enforce authentication
  const token = await getToken({ req: request, secret });

  if (!token) {
    const signInUrl = new URL('/api/auth/signin', request.url);
    signInUrl.searchParams.set('callbackUrl', request.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Media-service proxy (also covered by the catch-all below; listed so the route is explicit)
     */
    '/api/media/:path*',
    /*
     * Match all request paths except:
     * - api/auth/* (authentication routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
};
