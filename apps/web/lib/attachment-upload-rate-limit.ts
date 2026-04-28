/**
 * Per-user rate limiter for POST /api/runs/[id]/attachments.
 *
 * In-memory only — single-process correctness, single-VPS deployment.
 * Per CONTEXT.md threat model: "in-handler rate-limit at 10 req/min/user".
 *
 * Lives in its own module (not in the route file) because Next.js 15 routes
 * may only export `GET`, `POST`, etc. — any other named export fails the
 * production type-check. Tests import `resetRateLimiterForTest` from here
 * directly. Sibling to apps/web/lib/improve-prompt-rate-limit.ts which uses
 * the same pattern with a different cap.
 */

const RATE_LIMIT_MAX = 10;
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
