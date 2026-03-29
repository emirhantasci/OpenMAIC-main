import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'openmaic-auth';
const TOKEN_SEPARATOR = '.';
const MAX_TOKEN_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Paths that don't require authentication
const PUBLIC_PATHS = ['/login', '/api/auth/'];
const PUBLIC_PREFIXES = ['/_next/', '/favicon.ico', '/logos/', '/avatars/'];

function isPublicPath(pathname: string): boolean {
  for (const path of PUBLIC_PATHS) {
    if (pathname === path || pathname.startsWith(path)) return true;
  }
  for (const prefix of PUBLIC_PREFIXES) {
    if (pathname.startsWith(prefix)) return true;
  }
  return false;
}

async function verifyTokenEdge(token: string, secret: string): Promise<boolean> {
  try {
    const parts = token.split(TOKEN_SEPARATOR);
    if (parts.length !== 3) return false;

    const [timestamp, nonce, signature] = parts;
    const payload = `${timestamp}${TOKEN_SEPARATOR}${nonce}`;

    // Import key for HMAC
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );

    // Compute expected signature
    const sigBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const expected = Array.from(new Uint8Array(sigBytes))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Constant-time-ish comparison (both are hex strings of same algo output → same length)
    if (signature.length !== expected.length) return false;
    let mismatch = 0;
    for (let i = 0; i < signature.length; i++) {
      mismatch |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    if (mismatch !== 0) return false;

    // Check token age
    const tokenAge = Date.now() - parseInt(timestamp, 10);
    if (isNaN(tokenAge) || tokenAge < 0 || tokenAge > MAX_TOKEN_AGE_MS) return false;

    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const accessPassword = process.env.ACCESS_PASSWORD?.trim();

  // If no password configured, allow everything
  if (!accessPassword) return NextResponse.next();

  const { pathname } = request.nextUrl;

  // Allow public paths
  if (isPublicPath(pathname)) return NextResponse.next();

  // Check auth cookie
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (token && (await verifyTokenEdge(token, accessPassword))) {
    return NextResponse.next();
  }

  // Redirect to login
  const loginUrl = new URL('/login', request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logos/|avatars/).*)'],
};
