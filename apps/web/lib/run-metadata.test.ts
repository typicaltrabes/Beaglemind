import { describe, it, expect } from 'vitest';
import {
  formatDuration,
  formatRelativeTimestamp,
  countDistinctAgents,
} from './run-metadata';
import type { HubEventEnvelope } from '@beagle-console/shared';

const NOW = 1714000000000;

describe('formatDuration', () => {
  it('returns -- for null/undefined', () => {
    expect(formatDuration(null)).toBe('--');
    expect(formatDuration(undefined)).toBe('--');
  });
  it('returns -- for negative values', () => {
    expect(formatDuration(-5)).toBe('--');
  });
  it('formats sub-minute durations', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(59)).toBe('59s');
  });
  it('formats minute-plus durations', () => {
    expect(formatDuration(60)).toBe('1m');
    expect(formatDuration(138)).toBe('2m 18s');
    expect(formatDuration(3599)).toBe('59m 59s');
  });
  it('formats hour-plus durations', () => {
    expect(formatDuration(3600)).toBe('1h 0m');
    expect(formatDuration(3661)).toBe('1h 1m');
    expect(formatDuration(7325)).toBe('2h 2m');
  });
});

describe('formatRelativeTimestamp', () => {
  it('returns -- for null/undefined/malformed', () => {
    expect(formatRelativeTimestamp(null)).toBe('--');
    expect(formatRelativeTimestamp(undefined)).toBe('--');
    expect(formatRelativeTimestamp('NaN')).toBe('--');
  });
  it('returns just now under 1 minute', () => {
    const iso = new Date(NOW - 30_000).toISOString();
    expect(formatRelativeTimestamp(iso, NOW)).toBe('just now');
  });
  it('returns Xm ago at minutes', () => {
    const iso = new Date(NOW - 5 * 60_000).toISOString();
    expect(formatRelativeTimestamp(iso, NOW)).toBe('5m ago');
  });
  it('returns Xh ago at hours', () => {
    const iso = new Date(NOW - 3 * 60 * 60_000).toISOString();
    expect(formatRelativeTimestamp(iso, NOW)).toBe('3h ago');
  });
  it('returns Xd ago at days', () => {
    const iso = new Date(NOW - 5 * 24 * 60 * 60_000).toISOString();
    expect(formatRelativeTimestamp(iso, NOW)).toBe('5d ago');
  });
});

function ev(seq: number, agentId: string): HubEventEnvelope {
  return {
    sequenceNumber: seq,
    agentId,
    type: 'agent_message',
    content: { text: '' },
    metadata: {},
    timestamp: new Date(NOW).toISOString(),
  } as unknown as HubEventEnvelope;
}

describe('countDistinctAgents', () => {
  it('returns 0 for empty events', () => {
    expect(countDistinctAgents({}, [])).toBe(0);
  });
  it('counts distinct agent ids', () => {
    const events = { 1: ev(1, 'mo'), 2: ev(2, 'jarvis'), 3: ev(3, 'mo') };
    expect(countDistinctAgents(events, [1, 2, 3])).toBe(2);
  });
  it('excludes the user agent', () => {
    const events = { 1: ev(1, 'mo'), 2: ev(2, 'user') };
    expect(countDistinctAgents(events, [1, 2])).toBe(1);
  });
  it('matches case-insensitively', () => {
    const events = { 1: ev(1, 'Mo'), 2: ev(2, 'MO'), 3: ev(3, 'mo') };
    expect(countDistinctAgents(events, [1, 2, 3])).toBe(1);
  });
});
