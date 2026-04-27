import { describe, it, expect } from 'vitest';
import { computePresence } from './presence';
import type { HubEventEnvelope } from '@beagle-console/shared';

const NOW = 1714000000000;

function ev(seq: number, agentId: string, ageMs: number): HubEventEnvelope {
  return {
    sequenceNumber: seq,
    agentId,
    type: 'agent_message',
    content: { text: '' },
    metadata: {},
    timestamp: new Date(NOW - ageMs).toISOString(),
  } as unknown as HubEventEnvelope;
}

describe('computePresence', () => {
  it('returns offline for an agent with no events', () => {
    expect(computePresence({}, [], 'mo', NOW)).toBe('offline');
  });

  it('returns offline when only other agents have events', () => {
    const events = { 1: ev(1, 'jarvis', 30_000) };
    expect(computePresence(events, [1], 'mo', NOW)).toBe('offline');
  });

  it('returns live when last event 30s ago', () => {
    const events = { 1: ev(1, 'mo', 30_000) };
    expect(computePresence(events, [1], 'mo', NOW)).toBe('live');
  });

  it('returns live exactly at 60s boundary', () => {
    const events = { 1: ev(1, 'mo', 60_000) };
    expect(computePresence(events, [1], 'mo', NOW)).toBe('live');
  });

  it('returns ready at 10min ago', () => {
    const events = { 1: ev(1, 'mo', 600_000) };
    expect(computePresence(events, [1], 'mo', NOW)).toBe('ready');
  });

  it('returns ready exactly at 30min boundary', () => {
    const events = { 1: ev(1, 'mo', 30 * 60_000) };
    expect(computePresence(events, [1], 'mo', NOW)).toBe('ready');
  });

  it('returns offline at 60min ago', () => {
    const events = { 1: ev(1, 'mo', 60 * 60_000) };
    expect(computePresence(events, [1], 'mo', NOW)).toBe('offline');
  });

  it('uses MOST RECENT event for the agent (walks reverse)', () => {
    const events = {
      1: ev(1, 'mo', 60 * 60_000), // 60min ago
      2: ev(2, 'jarvis', 0),
      3: ev(3, 'mo', 30_000), // 30s ago
    };
    expect(computePresence(events, [1, 2, 3], 'mo', NOW)).toBe('live');
  });

  it('matches agentId case-insensitively', () => {
    const events = { 1: ev(1, 'Mo', 30_000) };
    expect(computePresence(events, [1], 'mo', NOW)).toBe('live');
  });

  it('skips malformed timestamps without faking live', () => {
    const broken = { ...ev(1, 'mo', 30_000), timestamp: 'NaN' as string };
    const events = { 1: broken as HubEventEnvelope };
    expect(computePresence(events, [1], 'mo', NOW)).toBe('offline');
  });
});
