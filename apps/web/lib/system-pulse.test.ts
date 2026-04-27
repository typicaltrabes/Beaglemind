import { describe, it, expect } from 'vitest';
import { computeSystemPulse } from './system-pulse';

const NOW = 1714000000000; // arbitrary fixed instant

describe('computeSystemPulse', () => {
  it('returns idle when no events', () => {
    expect(computeSystemPulse(null, NOW)).toBe('idle');
    expect(computeSystemPulse(undefined, NOW)).toBe('idle');
  });

  it('returns idle for a malformed timestamp', () => {
    expect(computeSystemPulse('NaN', NOW)).toBe('idle');
    expect(computeSystemPulse('not-a-date', NOW)).toBe('idle');
    expect(computeSystemPulse('', NOW)).toBe('idle');
  });

  it('returns live when last event was 30s ago', () => {
    const iso = new Date(NOW - 30_000).toISOString();
    expect(computeSystemPulse(iso, NOW)).toBe('live');
  });

  it('returns live exactly at 60s boundary', () => {
    const iso = new Date(NOW - 60_000).toISOString();
    expect(computeSystemPulse(iso, NOW)).toBe('live');
  });

  it('returns idle when last event was 90s ago', () => {
    const iso = new Date(NOW - 90_000).toISOString();
    expect(computeSystemPulse(iso, NOW)).toBe('idle');
  });

  it('returns idle when last event was 1 hour ago', () => {
    const iso = new Date(NOW - 3_600_000).toISOString();
    expect(computeSystemPulse(iso, NOW)).toBe('idle');
  });
});
