/**
 * Pure helpers for the Timeline tab (VIEW-01).
 *
 * Kept separate from the React component so they can be unit-tested in
 * isolation and reused by any future view that needs the same bucketing.
 *
 *   - filterTimelineEvents: mode-aware filter (drops sentinel_flag +
 *     state_transition in clean; always drops tldr_update).
 *   - computeXPositions: timestamp → [0, 1] position keyed by sequenceNumber.
 *   - nearestEventBySeq: slider-scrub helper; ties go to the lower seq.
 *   - sceneBoundaries: reduces scenes[] into renderable divider markers.
 */
import type { HubEventEnvelope } from '@beagle-console/shared';

import type { Scene } from '@/lib/stores/run-store';
import type { Mode } from '@/lib/mode-context';

export function filterTimelineEvents(
  events: HubEventEnvelope[],
  mode: Mode,
): HubEventEnvelope[] {
  return events.filter((e) => {
    if (e.type === 'tldr_update') return false;
    if (mode === 'clean' && (e.type === 'sentinel_flag' || e.type === 'state_transition')) {
      return false;
    }
    return true;
  });
}

export function computeXPositions(
  events: HubEventEnvelope[],
): Record<number, number> {
  const result: Record<number, number> = {};
  if (events.length === 0) return result;
  const times = events.map((e) => new Date(e.timestamp).getTime());
  const min = Math.min(...times);
  const max = Math.max(...times);
  const span = max - min;
  for (let i = 0; i < events.length; i++) {
    const t = times[i]!;
    result[events[i]!.sequenceNumber] = span === 0 ? 0 : (t - min) / span;
  }
  return result;
}

export function nearestEventBySeq(
  target: number,
  available: number[],
): number | null {
  if (available.length === 0) return null;
  let best = available[0]!;
  let bestDist = Math.abs(best - target);
  for (let i = 1; i < available.length; i++) {
    const s = available[i]!;
    const d = Math.abs(s - target);
    // Strictly closer wins. On ties, prefer the lower sequence number.
    if (d < bestDist || (d === bestDist && s < best)) {
      best = s;
      bestDist = d;
    }
  }
  return best;
}

export interface SceneBoundary {
  sceneId: string;
  sceneName: string;
  startSeq: number;
  firstTimestamp: string;
}

export function sceneBoundaries(
  scenes: Scene[],
  events: Record<number, HubEventEnvelope>,
): SceneBoundary[] {
  const out: SceneBoundary[] = [];
  for (const s of scenes) {
    if (!s.name) continue;
    const startSeq = s.eventSequences[0];
    if (startSeq === undefined) continue;
    const ev = events[startSeq];
    if (!ev) continue;
    out.push({
      sceneId: s.id,
      sceneName: s.name,
      startSeq,
      firstTimestamp: ev.timestamp,
    });
  }
  return out;
}
