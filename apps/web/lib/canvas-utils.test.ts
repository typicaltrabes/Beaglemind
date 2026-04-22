import { describe, it, expect } from 'vitest';
import type { HubEventEnvelope } from '@beagle-console/shared';

import {
  selectProximityComments,
  type ProximityComment,
} from './canvas-utils';

const mkEvent = (
  seq: number,
  type: string,
  agentId: string,
  extra: Partial<HubEventEnvelope> = {},
): HubEventEnvelope =>
  ({
    type: type as HubEventEnvelope['type'],
    agentId,
    runId: '00000000-0000-0000-0000-000000000000',
    tenantId: '00000000-0000-0000-0000-000000000000',
    sequenceNumber: seq,
    content: {},
    timestamp: `2026-04-22T12:00:${String(seq).padStart(2, '0')}.000Z`,
    ...extra,
  }) as HubEventEnvelope;

describe('selectProximityComments', () => {
  it('returns [] when messages is empty', () => {
    expect(selectProximityComments(10, [])).toEqual([]);
  });

  it('returns [] when messages has no agent_message events', () => {
    const events = [
      mkEvent(1, 'plan_proposal', 'mo'),
      mkEvent(2, 'artifact', 'jarvis'),
      mkEvent(3, 'question', 'mo'),
      mkEvent(4, 'state_transition', 'system'),
      mkEvent(5, 'sentinel_flag', 'sentinel'),
    ];
    expect(selectProximityComments(3, events)).toEqual([]);
  });

  it('ignores non-agent_message events when counting proximity', () => {
    // Target seq=10. A `question` event at seq=9 sits between target and the
    // nearest agent_message at seq=5. Result must pick the agent_message, not
    // the question.
    const events = [
      mkEvent(5, 'agent_message', 'mo'),
      mkEvent(9, 'question', 'mo'), // should be ignored
      mkEvent(15, 'agent_message', 'jarvis'),
    ];
    const result = selectProximityComments(10, events);
    expect(result.map((c) => c.event.sequenceNumber)).toEqual([5, 15]);
    expect(result.every((c) => c.event.type === 'agent_message')).toBe(true);
  });

  it('returns up to windowSize entries (default 5) even when more are available', () => {
    const events: HubEventEnvelope[] = [];
    for (let i = 1; i <= 20; i++) {
      events.push(mkEvent(i, 'agent_message', 'mo'));
    }
    const result = selectProximityComments(10, events);
    expect(result).toHaveLength(5);
  });

  it('returns fewer than windowSize when agent_message count is below windowSize', () => {
    const events = [
      mkEvent(1, 'agent_message', 'mo'),
      mkEvent(2, 'agent_message', 'jarvis'),
      mkEvent(3, 'agent_message', 'mo'),
    ];
    const result = selectProximityComments(10, events, 5);
    expect(result).toHaveLength(3);
  });

  it('returns results sorted ascending by sequenceNumber', () => {
    const events = [
      mkEvent(1, 'agent_message', 'mo'),
      mkEvent(5, 'agent_message', 'jarvis'),
      mkEvent(12, 'agent_message', 'mo'),
      mkEvent(20, 'agent_message', 'jarvis'),
    ];
    const result = selectProximityComments(10, events, 5);
    const seqs = result.map((c) => c.event.sequenceNumber);
    const sorted = [...seqs].sort((a, b) => a - b);
    expect(seqs).toEqual(sorted);
  });

  it('proximity ordering: target=10 with agent_messages at 5,7,12,13 and windowSize=3 picks 7,12,13', () => {
    const events = [
      mkEvent(5, 'agent_message', 'mo'),
      mkEvent(7, 'agent_message', 'jarvis'),
      mkEvent(12, 'agent_message', 'mo'),
      mkEvent(13, 'agent_message', 'jarvis'),
    ];
    const result = selectProximityComments(10, events, 3);
    // Distances: 5->5, 7->3, 12->2, 13->3. Closest 3 are 7(3), 12(2), 13(3).
    // Sorted ascending by sequenceNumber in output: 7, 12, 13.
    expect(result.map((c) => c.event.sequenceNumber)).toEqual([7, 12, 13]);
  });

  it('position labels: seq < target is "before", seq === target is "at", seq > target is "after"', () => {
    const events = [
      mkEvent(5, 'agent_message', 'mo'),
      mkEvent(10, 'agent_message', 'jarvis'), // same as target
      mkEvent(15, 'agent_message', 'mo'),
    ];
    const result: ProximityComment[] = selectProximityComments(10, events, 5);
    const byPos = new Map(result.map((c) => [c.event.sequenceNumber, c.position]));
    expect(byPos.get(5)).toBe('before');
    expect(byPos.get(10)).toBe('at');
    expect(byPos.get(15)).toBe('after');
  });

  it('tie-break at same distance picks the lower-seq event', () => {
    // Target=10. agent_messages at seq 8 (d=2) and seq 12 (d=2) with windowSize=1.
    // Tie at distance=2 → picks seq 8 (lower).
    const events = [
      mkEvent(8, 'agent_message', 'mo'),
      mkEvent(12, 'agent_message', 'jarvis'),
    ];
    const result = selectProximityComments(10, events, 1);
    expect(result).toHaveLength(1);
    expect(result[0]!.event.sequenceNumber).toBe(8);
  });
});
