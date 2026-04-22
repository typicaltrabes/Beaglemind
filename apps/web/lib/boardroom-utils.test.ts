import { describe, it, expect } from 'vitest';
import type { HubEventEnvelope } from '@beagle-console/shared';

import {
  filterBoardroomEvents,
  groupEventsByAgent,
  type AgentColumn,
} from './boardroom-utils';

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

describe('filterBoardroomEvents', () => {
  it('drops sentinel_flag in clean mode', () => {
    const events = [
      mkEvent(1, 'agent_message', 'mo'),
      mkEvent(2, 'sentinel_flag', 'sentinel'),
      mkEvent(3, 'agent_message', 'jarvis'),
    ];
    const result = filterBoardroomEvents(events, 'clean');
    expect(result.map((e) => e.sequenceNumber)).toEqual([1, 3]);
  });

  it('drops state_transition in clean mode', () => {
    const events = [
      mkEvent(1, 'agent_message', 'mo'),
      mkEvent(2, 'state_transition', 'system'),
      mkEvent(3, 'agent_message', 'jarvis'),
    ];
    const result = filterBoardroomEvents(events, 'clean');
    expect(result.map((e) => e.type)).toEqual(['agent_message', 'agent_message']);
  });

  it('keeps state_transition in studio mode', () => {
    const events = [
      mkEvent(1, 'agent_message', 'mo'),
      mkEvent(2, 'state_transition', 'system'),
      mkEvent(3, 'sentinel_flag', 'sentinel'),
    ];
    const result = filterBoardroomEvents(events, 'studio');
    expect(result.map((e) => e.type)).toEqual([
      'agent_message',
      'state_transition',
      'sentinel_flag',
    ]);
  });
});

describe('groupEventsByAgent', () => {
  it('returns an empty array when input is empty', () => {
    expect(groupEventsByAgent([], 'clean')).toEqual([]);
    expect(groupEventsByAgent([], 'studio')).toEqual([]);
  });

  it('returns one column per distinct agentId in order of first appearance', () => {
    const events = [
      mkEvent(1, 'agent_message', 'mo'),
      mkEvent(2, 'agent_message', 'jarvis'),
      mkEvent(3, 'agent_message', 'mo'),
      mkEvent(4, 'agent_message', 'user'),
    ];
    const result = groupEventsByAgent(events, 'clean');
    expect(result.map((c) => c.agentId)).toEqual(['mo', 'jarvis', 'user']);
  });

  it('sorts column events ascending by sequenceNumber even if input is out of order', () => {
    const events = [
      mkEvent(5, 'agent_message', 'mo'),
      mkEvent(1, 'agent_message', 'mo'),
      mkEvent(3, 'agent_message', 'mo'),
    ];
    const result = groupEventsByAgent(events, 'clean');
    expect(result).toHaveLength(1);
    expect(result[0]!.events.map((e) => e.sequenceNumber)).toEqual([1, 3, 5]);
  });

  it('includes the user column (agentId=\"user\") without special-casing', () => {
    const events = [
      mkEvent(1, 'agent_message', 'user'),
      mkEvent(2, 'agent_message', 'mo'),
    ];
    const result = groupEventsByAgent(events, 'clean');
    const userCol = result.find((c) => c.agentId === 'user');
    expect(userCol).toBeDefined();
    expect(userCol!.events.map((e) => e.sequenceNumber)).toEqual([1]);
  });

  it('replicates a single state_transition event into every agent column in studio mode (each column contains it exactly once)', () => {
    const events = [
      mkEvent(1, 'agent_message', 'mo'),
      mkEvent(2, 'agent_message', 'jarvis'),
      mkEvent(3, 'state_transition', 'system'),
      mkEvent(4, 'agent_message', 'mo'),
    ];
    const result: AgentColumn[] = groupEventsByAgent(events, 'studio');
    expect(result.map((c) => c.agentId)).toEqual(['mo', 'jarvis']);
    for (const col of result) {
      const transitionCount = col.events.filter(
        (e) => e.type === 'state_transition',
      ).length;
      expect(transitionCount).toBe(1);
    }
    // Mo column: seq 1, 3 (replicated transition), 4 — ascending
    expect(result[0]!.events.map((e) => e.sequenceNumber)).toEqual([1, 3, 4]);
    // Jarvis column: seq 2, 3 (replicated) — ascending
    expect(result[1]!.events.map((e) => e.sequenceNumber)).toEqual([2, 3]);
  });

  it('produces 0 columns in clean mode when the run has only state_transition events', () => {
    const events = [
      mkEvent(1, 'state_transition', 'system'),
      mkEvent(2, 'state_transition', 'system'),
    ];
    const result = groupEventsByAgent(events, 'clean');
    expect(result).toEqual([]);
  });

  it('produces 0 columns in studio mode when the run has only state_transition events (nothing to replicate into)', () => {
    const events = [
      mkEvent(1, 'state_transition', 'system'),
      mkEvent(2, 'state_transition', 'system'),
    ];
    const result = groupEventsByAgent(events, 'studio');
    expect(result).toEqual([]);
  });

  it('drops sentinel_flag from columns in clean mode', () => {
    const events = [
      mkEvent(1, 'agent_message', 'mo'),
      mkEvent(2, 'sentinel_flag', 'sentinel'),
      mkEvent(3, 'agent_message', 'mo'),
    ];
    const result = groupEventsByAgent(events, 'clean');
    // Sentinel should not form its own column (its only event was filtered)
    expect(result.map((c) => c.agentId)).toEqual(['mo']);
    expect(result[0]!.events.map((e) => e.sequenceNumber)).toEqual([1, 3]);
  });

  it('keeps sentinel_flag in its own agent column in studio mode', () => {
    const events = [
      mkEvent(1, 'agent_message', 'mo'),
      mkEvent(2, 'sentinel_flag', 'sentinel'),
    ];
    const result = groupEventsByAgent(events, 'studio');
    expect(result.map((c) => c.agentId)).toEqual(['mo', 'sentinel']);
  });
});
