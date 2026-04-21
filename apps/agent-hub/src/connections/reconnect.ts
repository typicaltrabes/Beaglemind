export type ConnectionState =
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'reconnecting'
  | 'closed';

/**
 * Exponential backoff with jitter per D-04.
 * base 1s, max 30s, jitter factor 0.5.
 *
 * attempt 0: ~1000ms
 * attempt 1: ~2000ms
 * attempt 3: ~8000ms
 * caps at ~30000ms
 */
export function calculateBackoff(
  attempt: number,
  base = 1000,
  max = 30000,
  jitter = 0.5,
): number {
  const exponential = Math.min(base * Math.pow(2, attempt), max);
  const jitterRange = exponential * jitter;
  const jittered = exponential + (Math.random() * 2 - 1) * jitterRange;
  return Math.max(0, Math.floor(jittered));
}
