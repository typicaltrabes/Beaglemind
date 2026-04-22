import type { HubEventEnvelope } from '@beagle-console/shared';
import type { Mode } from '@/lib/mode-context';

/**
 * Filter events for the Boardroom view.
 *
 * - Clean mode: drops `sentinel_flag` (noise) AND `state_transition` (run-level,
 *   not agent-level — per CONTEXT.md §Boardroom view decisions).
 * - Studio mode: keeps everything so run-level transitions can be replicated
 *   into each column by `groupEventsByAgent`.
 */
export function filterBoardroomEvents(
  messages: HubEventEnvelope[],
  mode: Mode,
): HubEventEnvelope[] {
  if (mode === 'studio') return messages.slice();
  return messages.filter(
    (e) => e.type !== 'sentinel_flag' && e.type !== 'state_transition',
  );
}

export interface AgentColumn {
  agentId: string;
  events: HubEventEnvelope[];
}

/**
 * Group filtered events into per-agent columns for the Boardroom view.
 *
 * - Columns ordered by first appearance of each agentId in the input.
 * - Each column's events are sorted ascending by `sequenceNumber`.
 * - In studio mode, `state_transition` events (run-level, no single agent)
 *   are replicated into EVERY column so each agent's column shows the same
 *   run-wide transitions at their correct chronological position.
 * - Columns are only created for agents with at least one non-state_transition
 *   event; a run with only state_transition events produces 0 columns
 *   (matches the "No agent activity yet" empty state).
 */
export function groupEventsByAgent(
  messages: HubEventEnvelope[],
  mode: Mode,
): AgentColumn[] {
  const filtered = filterBoardroomEvents(messages, mode);
  const order: string[] = [];
  const byAgent = new Map<string, HubEventEnvelope[]>();
  const runLevelEvents: HubEventEnvelope[] = []; // state_transition in studio

  for (const e of filtered) {
    if (e.type === 'state_transition') {
      runLevelEvents.push(e);
      continue;
    }
    if (!byAgent.has(e.agentId)) {
      order.push(e.agentId);
      byAgent.set(e.agentId, []);
    }
    byAgent.get(e.agentId)!.push(e);
  }

  // Replicate run-level events into every column (studio only — runLevelEvents
  // is empty in clean since filterBoardroomEvents already stripped them).
  if (runLevelEvents.length > 0) {
    for (const agentId of order) {
      const list = byAgent.get(agentId)!;
      for (const rle of runLevelEvents) list.push(rle);
    }
  }

  // Each column's events are sorted ascending by sequenceNumber regardless of
  // input order — callers rely on this invariant for chronological rendering.
  for (const list of byAgent.values()) {
    list.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  }

  return order.map((agentId) => ({ agentId, events: byAgent.get(agentId)! }));
}
