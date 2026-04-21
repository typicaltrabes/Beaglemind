import type { HubEventEnvelope } from '@beagle-console/shared';

export interface CollapsibleRange {
  startSeq: number;
  endSeq: number;
  sequences: number[];
  agentIds: string[];    // unique, sorted alphabetically
  messageCount: number;
  startTime: string;     // ISO timestamp of first message
  endTime: string;       // ISO timestamp of last message
}

/** Event types that NEVER collapse (D-07) */
const UNCOLLAPSIBLE_TYPES: Set<string> = new Set([
  'plan_proposal',
  'question',
  'artifact',
  'state_transition',
  'tldr_update',
]);

/**
 * Detect runs of >3 consecutive non-user agent_message events
 * that can be collapsed into a fold (D-05).
 *
 * Pure function — no store dependency.
 */
export function detectCollapsibleRanges(
  eventOrder: number[],
  events: Record<number, HubEventEnvelope>,
): CollapsibleRange[] {
  const ranges: CollapsibleRange[] = [];

  let runSeqs: number[] = [];
  let runAgents = new Set<string>();

  function flushRun() {
    if (runSeqs.length > 3) {
      const first = events[runSeqs[0]!]!;
      const last = events[runSeqs[runSeqs.length - 1]!]!;
      ranges.push({
        startSeq: runSeqs[0]!,
        endSeq: runSeqs[runSeqs.length - 1]!,
        sequences: [...runSeqs],
        agentIds: [...runAgents].sort(),
        messageCount: runSeqs.length,
        startTime: first.timestamp,
        endTime: last.timestamp,
      });
    }
    runSeqs = [];
    runAgents = new Set<string>();
  }

  for (const seq of eventOrder) {
    const event = events[seq];
    if (!event) continue;

    // Break run on uncollapsible type
    if (UNCOLLAPSIBLE_TYPES.has(event.type)) {
      flushRun();
      continue;
    }

    // Break run on user message
    if (event.agentId === 'user') {
      flushRun();
      continue;
    }

    // agent_message from a non-user agent — extend run
    if (event.type === 'agent_message') {
      runSeqs.push(seq);
      runAgents.add(event.agentId);
      continue;
    }

    // Any other type (e.g. system) — break run
    flushRun();
  }

  // Flush final run
  flushRun();

  return ranges;
}
