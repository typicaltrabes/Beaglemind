import type { HubEventEnvelope } from '@beagle-console/shared';

/**
 * Per-agent presence states.
 *   'live'    — last event ≤60s ago
 *   'ready'   — last event ≤30min ago (was active recently)
 *   'offline' — never sent an event, or last event >30min ago
 *
 * Per CONTEXT.md <specifics>: "default to 'offline' not 'live' if an agent
 * has no events at all — never show a fake live signal."
 */
export type PresenceStatus = 'live' | 'ready' | 'offline';

export const PRESENCE_LIVE_WINDOW_MS = 60_000; // 60s
export const PRESENCE_READY_WINDOW_MS = 30 * 60_000; // 30min

/**
 * Pure helper. Given the run-store's current events bag + ordering and an
 * agent id, returns the presence status. Implementation walks `eventOrder`
 * from the END (most recent first) until it finds an event by `agentId`,
 * which is O(K) in practice where K is small for "any recent event by this
 * agent" (most recent runs dominate).
 */
export function computePresence(
  events: Record<number, HubEventEnvelope>,
  eventOrder: number[],
  agentId: string,
  nowMs: number,
): PresenceStatus {
  const target = agentId.toLowerCase();
  // Walk most-recent first.
  for (let i = eventOrder.length - 1; i >= 0; i--) {
    const seq = eventOrder[i]!;
    const ev = events[seq];
    if (!ev) continue;
    if (ev.agentId.toLowerCase() !== target) continue;
    const t = Date.parse(ev.timestamp);
    if (Number.isNaN(t)) continue; // malformed → skip, don't fake live
    const delta = nowMs - t;
    if (delta <= PRESENCE_LIVE_WINDOW_MS) return 'live';
    if (delta <= PRESENCE_READY_WINDOW_MS) return 'ready';
    return 'offline';
  }
  return 'offline';
}
