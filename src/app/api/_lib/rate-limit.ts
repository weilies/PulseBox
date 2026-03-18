/**
 * Simple in-memory rate limiter.
 * 100 requests / 60 s per key (token prefix or IP).
 * Good enough for single-instance dev/staging; swap for Redis in production.
 */

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 100;

const store = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string): {
  ok: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, remaining: MAX_REQUESTS - 1, resetAt: now + WINDOW_MS };
  }

  entry.count++;
  const remaining = MAX_REQUESTS - entry.count;

  if (remaining < 0) {
    return { ok: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { ok: true, remaining, resetAt: entry.resetAt };
}

export function rateLimitHeaders(remaining: number, resetAt: number) {
  return {
    "X-RateLimit-Limit": String(MAX_REQUESTS),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
  };
}
