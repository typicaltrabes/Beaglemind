/**
 * Per-user rate limiter for POST /api/runs/improve-prompt.
 *
 * In-memory only — single-process correctness, single-VPS deployment.
 * Per CONTEXT.md `<decisions>` Item 3: "trivially low-cost per call (Haiku,
 * 800 tokens) but add a per-user 30-req/min in-memory limiter to prevent
 * button-spam abuse. Use a simple Map<userId, timestamps[]> ... (no Redis
 * — overkill for this)."
 *
 * Lives in its own module (not in the route file) because Next.js 15 routes
 * may only export `GET`, `POST`, etc. — any other named export fails the
 * production type-check. Tests import `resetRateLimiterForTest` from here
 * directly.
 */

const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;
const userTimestamps = new Map<string, number[]>();

export function rateLimitOk(userId: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const arr = userTimestamps.get(userId) ?? [];
  // Drop timestamps outside the window.
  const recent = arr.filter((t) => t > cutoff);
  if (recent.length >= RATE_LIMIT_MAX) {
    // Persist the trimmed list so memory doesn't grow unboundedly.
    userTimestamps.set(userId, recent);
    return false;
  }
  recent.push(now);
  userTimestamps.set(userId, recent);
  return true;
}

export function resetRateLimiterForTest() {
  userTimestamps.clear();
}
