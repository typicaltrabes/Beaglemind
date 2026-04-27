/**
 * Base playback tick: 1500ms per event at 1× speed (slowed from 400ms after
 * UAT — original pace was unreadable; user could not see what each agent
 * was saying as the playhead advanced).
 *   1× = 1500ms (readable default)
 *   2× = 750ms  (skim)
 *   4× = 375ms  (fast scan)
 */
export const TIMELINE_BASE_INTERVAL_MS = 1500;

/**
 * Advances the playhead by exactly one position (clamped). The playhead is
 * an INDEX into the visible-events array, not a sequence number — so the
 * timeline-view component can pass `visibleSeqs.length` and we don't need
 * to know the underlying seq numbers in this helper.
 *
 * Edge cases:
 *   - Empty list → 0 (nothing to advance into).
 *   - Negative input → 0 (floor a malformed index; do NOT advance from it).
 *     This matches the behavior spec: a negative playhead is "before the
 *     timeline starts," and reset-to-start is safer than silently jumping
 *     forward by one as if the negative index were valid.
 *   - At/past last index → clamped to last (no wrap).
 */
export function advancePlayhead(currentIndex: number, visibleSeqs: number[]): number {
  if (visibleSeqs.length === 0) return 0;
  const max = visibleSeqs.length - 1;
  // Floor negative/invalid indices to 0 WITHOUT advancing.
  if (currentIndex < 0) return 0;
  const clamped = Math.min(currentIndex, max);
  return Math.min(clamped + 1, max);
}

/**
 * Returns the milliseconds-per-tick for the given speed multiplier.
 * 1× = 1500ms (default), 2× = 750ms, 4× = 375ms. Anything ≤0 falls back to 1×.
 */
export function computeIntervalMs(speed: number): number {
  const safe = speed > 0 ? speed : 1;
  return Math.round(TIMELINE_BASE_INTERVAL_MS / safe);
}

/**
 * True when an event's sequence number is at or before the playhead's
 * current sequence (rendered saturated; everything after is dim).
 *
 *   isPlayed(eventSeq, playheadSeq) returns boolean.
 *
 * Equality counts as "played" — the playhead's current position is the
 * brightest dot.
 */
export function isPlayed(eventSeq: number, playheadSeq: number): boolean {
  return eventSeq <= playheadSeq;
}
