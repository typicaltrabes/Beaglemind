import type { HubEventEnvelope } from '@beagle-console/shared';

/**
 * Format duration in seconds → human-readable.
 *   null → '--'
 *   0–59s → '<n>s'
 *   60–3599s → '<m>m <s>s' (omit seconds when zero)
 *   3600+ → '<h>h <m>m'
 *
 * Mirrors the Run-History-Table convention so users see the same units
 * across both surfaces.
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '--';
  if (seconds < 0) return '--';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s === 0 ? `${m}m` : `${m}m ${s}s`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

/**
 * Format an ISO timestamp as a short relative string ('5m ago' / '3h ago' /
 * '5d ago'). Matches RunHistoryTable.formatRelativeDate but exposed as a
 * pure helper so the tabular row in RunMetadataRow has its own tested
 * helper.
 */
export function formatRelativeTimestamp(
  iso: string | null | undefined,
  nowMs: number = Date.now(),
): string {
  if (!iso) return '--';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '--';
  const diffMs = nowMs - t;
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

/**
 * Count distinct agent ids participating in the events list.
 * Case-insensitive. The 'user' agent is excluded so the metadata row
 * shows "agents working on the run" not "humans + agents".
 */
export function countDistinctAgents(
  events: Record<number, HubEventEnvelope>,
  eventOrder: number[],
): number {
  const seen = new Set<string>();
  for (const seq of eventOrder) {
    const ev = events[seq];
    if (!ev || !ev.agentId) continue;
    const id = ev.agentId.toLowerCase();
    // Phase 18-04 (H4): exclude `user` and `system` from "N agents" count.
    // system events (state_transitions) inflated the number for users; the
    // run header now reflects actual conversational agents only.
    if (id === 'user' || id === 'system') continue;
    seen.add(id);
  }
  return seen.size;
}
