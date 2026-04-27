/**
 * System pulse states. 'live' triggers the emerald-500 + animate-pulse
 * indicator in the header; 'idle' renders a static gray-500 dot.
 */
export type SystemPulseStatus = 'live' | 'idle';

/**
 * Threshold for considering the system "live" — 60s per CONTEXT.md
 * <decisions> Track 1.
 */
export const PULSE_LIVE_WINDOW_MS = 60_000;

/**
 * Pure helper. Returns 'live' if `lastEventTimestampIso` is within
 * PULSE_LIVE_WINDOW_MS of `nowMs`, otherwise 'idle'. Defensive against
 * empty/malformed timestamps so a corrupt event row never fakes live status.
 */
export function computeSystemPulse(
  lastEventTimestampIso: string | null | undefined,
  nowMs: number,
): SystemPulseStatus {
  if (!lastEventTimestampIso) return 'idle';
  const t = Date.parse(lastEventTimestampIso);
  if (Number.isNaN(t)) return 'idle';
  return nowMs - t <= PULSE_LIVE_WINDOW_MS ? 'live' : 'idle';
}
