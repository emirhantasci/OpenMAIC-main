interface AttemptRecord {
  count: number;
  lastAttempt: number;
  lockUntil: number;
}

const attempts = new Map<string, AttemptRecord>();
let checkCount = 0;

// Escalating lockout thresholds
const LOCKOUT_TIERS = [
  { threshold: 5, durationMs: 60 * 1000 },          // 5 failures  → 1 minute
  { threshold: 10, durationMs: 5 * 60 * 1000 },     // 10 failures → 5 minutes
  { threshold: 20, durationMs: 30 * 60 * 1000 },    // 20 failures → 30 minutes
  { threshold: 50, durationMs: 24 * 60 * 60 * 1000 }, // 50 failures → 24 hours
];

const CLEANUP_INTERVAL = 1000; // run cleanup every N checks
const STALE_THRESHOLD = 24 * 60 * 60 * 1000; // remove records older than 24h

function cleanup() {
  const now = Date.now();
  for (const [ip, record] of attempts) {
    if (now - record.lastAttempt > STALE_THRESHOLD && now > record.lockUntil) {
      attempts.delete(ip);
    }
  }
}

export function checkRateLimit(ip: string): { allowed: boolean; retryAfterSeconds?: number } {
  // Periodic cleanup
  checkCount++;
  if (checkCount % CLEANUP_INTERVAL === 0) {
    cleanup();
  }

  const record = attempts.get(ip);
  if (!record) return { allowed: true };

  const now = Date.now();
  if (now < record.lockUntil) {
    const retryAfterSeconds = Math.ceil((record.lockUntil - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true };
}

export function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const record = attempts.get(ip) ?? { count: 0, lastAttempt: now, lockUntil: 0 };

  record.count++;
  record.lastAttempt = now;

  // Find the highest applicable lockout tier
  for (let i = LOCKOUT_TIERS.length - 1; i >= 0; i--) {
    if (record.count >= LOCKOUT_TIERS[i].threshold) {
      record.lockUntil = now + LOCKOUT_TIERS[i].durationMs;
      break;
    }
  }

  attempts.set(ip, record);
}

export function resetAttempts(ip: string): void {
  attempts.delete(ip);
}
