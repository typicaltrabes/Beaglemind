import { describe, it, expect } from 'vitest';
import type { HubEventEnvelope } from '@beagle-console/shared';
import { orderedAgents, buildSceneGrid } from './boardroom-grid';

function ev(seq: number, agentId: string): HubEventEnvelope {
  return {
    sequenceNumber: seq,
    agentId,
    type: 'agent_message',
    runId: 'r',
    tenantId: 't',
    content: { text: `e${seq}` },
    timestamp: '2026-01-01T00:00:00Z',
  } as HubEventEnvelope;
}

describe('orderedAgents', () => {
  it('sorts known agents into the canonical order; user last', () => {
    expect(orderedAgents(['herman', 'user', 'mo', 'jarvis'])).toEqual([
      'mo',
      'jarvis',
      'herman',
      'user',
    ]);
  });
  it('preserves unknown agents after known, before user', () => {
    expect(orderedAgents(['unknown', 'mo'])).toEqual(['mo', 'unknown']);
  });
  it('places user last when present, dedups all', () => {
    expect(orderedAgents(['user', 'unknown', 'user'])).toEqual([
      'unknown',
      'user',
    ]);
  });
  it('handles empty input', () => {
    expect(orderedAgents([])).toEqual([]);
  });
  it('preserves multiple unknowns in input order', () => {
    expect(orderedAgents(['x', 'y', 'mo', 'z'])).toEqual(['mo', 'x', 'y', 'z']);
  });
});

describe('buildSceneGrid', () => {
  it('returns empty rows when no messages', () => {
    const out = buildSceneGrid([], [], {});
    expect(out.rows).toEqual([]);
    expect(out.agents).toEqual([]);
  });

  it('returns a single synthetic Run row when no scenes', () => {
    const messages = [ev(1, 'mo'), ev(2, 'jarvis')];
    const events = { 1: messages[0]!, 2: messages[1]! };
    const out = buildSceneGrid(messages, [], events);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]!.sceneId).toBe('run');
    expect(out.rows[0]!.sceneName).toBe('Run');
    expect(out.rows[0]!.cells.mo!.map((e) => e.sequenceNumber)).toEqual([1]);
    expect(out.rows[0]!.cells.jarvis!.map((e) => e.sequenceNumber)).toEqual([2]);
    expect(out.agents).toEqual(['mo', 'jarvis']);
  });

  it('buckets events into the correct scenes when scenes are defined', () => {
    const messages = [ev(1, 'mo'), ev(2, 'jarvis'), ev(3, 'mo')];
    const events = { 1: messages[0]!, 2: messages[1]!, 3: messages[2]! };
    const scenes = [
      { id: 's1', name: 'Intro', eventSequences: [1, 2] },
      { id: 's2', name: 'Outro', eventSequences: [3] },
    ];
    const out = buildSceneGrid(messages, scenes, events);
    expect(out.rows).toHaveLength(2);
    expect(out.rows[0]!.sceneName).toBe('Intro');
    expect(out.rows[0]!.cells.mo!.map((e) => e.sequenceNumber)).toEqual([1]);
    expect(out.rows[0]!.cells.jarvis!.map((e) => e.sequenceNumber)).toEqual([2]);
    expect(out.rows[1]!.sceneName).toBe('Outro');
    expect(out.rows[1]!.cells.mo!.map((e) => e.sequenceNumber)).toEqual([3]);
    expect(out.rows[1]!.cells.jarvis ?? []).toEqual([]);
  });

  it('sorts cell events ascending by sequence', () => {
    const messages = [ev(3, 'mo'), ev(1, 'mo'), ev(2, 'mo')];
    const events = { 1: messages[1]!, 2: messages[2]!, 3: messages[0]! };
    const out = buildSceneGrid(messages, [], events);
    expect(out.rows[0]!.cells.mo!.map((e) => e.sequenceNumber)).toEqual([1, 2, 3]);
  });
});
