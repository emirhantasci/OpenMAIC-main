import { NextRequest, NextResponse } from 'next/server';
import { isAuthEnabled, verifyPassword, createAuthToken, COOKIE_NAME, COOKIE_MAX_AGE } from '@/lib/auth';
import { checkRateLimit, recordFailedAttempt, resetAttempts } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.json({ error: 'Auth not enabled' }, { status: 404 });
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  // Rate limit check
  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts', retryAfterSeconds: rateCheck.retryAfterSeconds },
      { status: 429 },
    );
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const password = body.password;
  if (typeof password !== 'string' || password.length === 0) {
    return NextResponse.json({ error: 'Password required' }, { status: 400 });
  }

  if (!verifyPassword(password)) {
    recordFailedAttempt(ip);
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  }

  // Success — reset rate limit and set cookie
  resetAttempts(ip);
  const token = createAuthToken();

  const isProduction = process.env.NODE_ENV === 'production';
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: isProduction,
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });

  return response;
}
