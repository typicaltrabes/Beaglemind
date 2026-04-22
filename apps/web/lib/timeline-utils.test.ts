import { describe, it, expect } from 'vitest';
import type { HubEventEnvelope } from '@beagle-console/shared';

import {
  filterTimelineEvents,
  computeXPositions,
  nearestEventBySeq,
  sceneBoundaries,
} from './timeline-utils';
import type { Scene } from './stores/run-store';

const mkEvent = (
  seq: number,
  type: string,
  ts: string,
  extra: Partial<HubEventEnvelope> = {},
): HubEventEnvelope =>
  ({
    type: type as HubEventEnvelope['type'],
    agentId: 'mo',
    runId: '00000000-0000-0000-0000-000000000000',
    tenantId: '00000000-0000-0000-0000-000000000000',
    sequenceNumber: seq,
    content: {},
    timestamp: ts,
    ...extra,
  }) as HubEventEnvelope;

describe('filterTimelineEvents', () => {
  it('drops sentinel_flag in clean mode', () => {
    const events = [
      mkEvent(1, 'agent_message', '2026-04-22T12:00:00.000Z'),
      mkEvent(2, 'sentinel_flag', '2026-04-22T12:00:01.000Z'),
      mkEvent(3, 'agent_message', '2026-04-22T12:00:02.000Z'),
    ];
    const result = filterTimelineEvents(events, 'clean');
    expect(result.map((e) => e.sequenceNumber)).toEqual([1, 3]);
  });

  it('drops state_transition in clean mode', () => {
    const events = [
      mkEvent(1, 'agent_message', '2026-04-22T12:00:00.000Z'),
      mkEvent(2, 'state_transition', '2026-04-22T12:00:01.000Z'),
      mkEvent(3, 'agent_message', '2026-04-22T12:00:02.000Z'),
    ];
    const result = filterTimelineEvents(events, 'clean');
    expect(result.map((e) => e.sequenceNumber)).toEqual([1, 3]);
  });

  it('keeps sentinel_flag and state_transition in studio mode', () => {
    const events = [
      mkEvent(1, 'agent_message', '2026-04-22T12:00:00.000Z'),
      mkEvent(2, 'sentinel_flag', '2026-04-22T12:00:01.000Z'),
      mkEvent(3, 'state_transition', '2026-04-22T12:00:02.000Z'),
    ];
    const result = filterTimelineEvents(events, 'studio');
    expect(result.map((e) => e.sequenceNumber)).toEqual([1, 2, 3]);
  });

  it('drops tldr_update in both modes', () => {
    const events = [
      mkEvent(1, 'agent_message', '2026-04-22T12:00:00.000Z'),
      mkEvent(2, 'tldr_update', '2026-04-22T12:00:01.000Z'),
      mkEvent(3, 'agent_message', '2026-04-22T12:00:02.000Z'),
    ];
    expect(filterTimelineEvents(events, 'clean').map((e) => e.sequenceNumber)).toEqual([1, 3]);
    expect(filterTimelineEvents(events, 'studio').map((e) => e.sequenceNumber)).toEqual([1, 3]);
  });

  it('preserves relative order of visible events', () => {
    const events = [
      mkEvent(10, 'agent_message', '2026-04-22T12:00:00.000Z'),
      mkEvent(5, 'agent_message', '2026-04-22T12:00:01.000Z'),
      mkEvent(42, 'agent_message', '2026-04-22T12:00:02.000Z'),
    ];
    const result = filterTimelineEvents(events, 'studio');
    expect(result.map((e) => e.sequenceNumber)).toEqual([10, 5, 42]);
  });
});

describe('computeXPositions', () => {
  it('returns empty object for empty input', () => {
    expect(computeXPositions([])).toEqual({});
  });

  it('returns 0 for all events when all timestamps are identical', () => {
    const events = [
      mkEvent(1, 'agent_message', '2026-04-22T12:00:00.000Z'),
      mkEvent(2, 'agent_message', '2026-04-22T12:00:00.000Z'),
      mkEvent(3, 'agent_message', '2026-04-22T12:00:00.000Z'),
    ];
    const xs = computeXPositions(events);
    expect(xs[1]).toBe(0);
    expect(xs[2]).toBe(0);
    expect(xs[3]).toBe(0);
  });

  it('returns 0 and 1 for min/max and proportional for middle', () => {
    const events = [
      mkEvent(1, 'agent_message', '2026-04-22T12:00:00.000Z'),
      mkEvent(2, 'agent_message', '2026-04-22T12:00:05.000Z'),
      mkEvent(3, 'agent_message', '2026-04-22T12:00:10.000Z'),
    ];
    const xs = computeXPositions(events);
    expect(xs[1]).toBe(0);
    expect(xs[3]).toBe(1);
    expect(xs[2]).toBeCloseTo(0.5, 5);
  });
});

describe('nearestEventBySeq', () => {
  it('returns null for empty input array', () => {
    expect(nearestEventBySeq(5, [])).toBeNull();
  });

  it('returns the exact match when target is in the array', () => {
    expect(nearestEventBySeq(7, [1, 3, 7, 10])).toBe(7);
  });

  it('returns the lower seq on tie', () => {
    // target=5, available=[3,7] — both distance 2, tie → 3
    expect(nearestEventBySeq(5, [3, 7])).toBe(3);
  });
});

describe('sceneBoundaries', () => {
  it('skips scenes with empty name', () => {
    const events: Record<number, HubEventEnvelope> = {
      1: mkEvent(1, 'agent_message', '2026-04-22T12:00:00.000Z'),
    };
    const scenes: Scene[] = [
      { id: 'unscened', name: '', eventSequences: [1] },
    ];
    expect(sceneBoundaries(scenes, events)).toEqual([]);
  });

  it('skips scenes whose first event is missing from events record', () => {
    const events: Record<number, HubEventEnvelope> = {
      1: mkEvent(1, 'agent_message', '2026-04-22T12:00:00.000Z'),
    };
    const scenes: Scene[] = [
      { id: 'a', name: 'Scene A', eventSequences: [99] }, // seq 99 is not in events
    ];
    expect(sceneBoundaries(scenes, events)).toEqual([]);
  });

  it('returns one entry per named scene with correct startSeq and firstTimestamp', () => {
    const events: Record<number, HubEventEnvelope> = {
      1: mkEvent(1, 'agent_message', '2026-04-22T12:00:00.000Z'),
      5: mkEvent(5, 'agent_message', '2026-04-22T12:01:00.000Z'),
      9: mkEvent(9, 'agent_message', '2026-04-22T12:02:00.000Z'),
    };
    const scenes: Scene[] = [
      { id: 'a', name: 'Scene A', eventSequences: [1, 2, 3] },
      { id: 'b', name: 'Scene B', eventSequences: [5, 6, 7] },
      { id: 'c', name: '', eventSequences: [9] }, // skipped (empty name)
    ];
    const result = sceneBoundaries(scenes, events);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      sceneId: 'a',
      sceneName: 'Scene A',
      startSeq: 1,
      firstTimestamp: '2026-04-22T12:00:00.000Z',
    });
    expect(result[1]).toEqual({
      sceneId: 'b',
      sceneName: 'Scene B',
      startSeq: 5,
      firstTimestamp: '2026-04-22T12:01:00.000Z',
    });
  });

  it('skips scenes with empty eventSequences array', () => {
    const events: Record<number, HubEventEnvelope> = {
      1: mkEvent(1, 'agent_message', '2026-04-22T12:00:00.000Z'),
    };
    const scenes: Scene[] = [
      { id: 'a', name: 'Scene A', eventSequences: [] },
    ];
    expect(sceneBoundaries(scenes, events)).toEqual([]);
  });
});
