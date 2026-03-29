import crypto from 'crypto';

const COOKIE_NAME = 'openmaic-auth';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds
const TOKEN_SEPARATOR = '.';

export { COOKIE_NAME, COOKIE_MAX_AGE };

export function isAuthEnabled(): boolean {
  return !!process.env.ACCESS_PASSWORD?.trim();
}

export function verifyPassword(input: string): boolean {
  const expected = process.env.ACCESS_PASSWORD ?? '';
  if (input.length === 0 || expected.length === 0) return false;

  const inputBuf = Buffer.from(input);
  const expectedBuf = Buffer.from(expected);

  if (inputBuf.length !== expectedBuf.length) {
    // Compare against expected anyway to avoid timing leak on length
    crypto.timingSafeEqual(expectedBuf, expectedBuf);
    return false;
  }

  return crypto.timingSafeEqual(inputBuf, expectedBuf);
}

export function createAuthToken(): string {
  const secret = process.env.ACCESS_PASSWORD!;
  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now().toString();
  const payload = `${timestamp}${TOKEN_SEPARATOR}${nonce}`;
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}${TOKEN_SEPARATOR}${hmac}`;
}

export function verifyAuthToken(token: string): boolean {
  try {
    const secret = process.env.ACCESS_PASSWORD;
    if (!secret) return false;

    const parts = token.split(TOKEN_SEPARATOR);
    if (parts.length !== 3) return false;

    const [timestamp, nonce, signature] = parts;
    const payload = `${timestamp}${TOKEN_SEPARATOR}${nonce}`;
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    // Timing-safe comparison of signatures
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return false;
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return false;

    // Check token age (7 days)
    const tokenAge = Date.now() - parseInt(timestamp, 10);
    if (isNaN(tokenAge) || tokenAge < 0 || tokenAge > COOKIE_MAX_AGE * 1000) return false;

    return true;
  } catch {
    return false;
  }
}
