import { describe, it, expect } from 'vitest';
import {
  advancePlayhead,
  computeIntervalMs,
  isPlayed,
  TIMELINE_BASE_INTERVAL_MS,
} from './timeline-playback';

describe('advancePlayhead', () => {
  it('moves from 0 to 1 with non-empty list', () => {
    expect(advancePlayhead(0, [10, 20, 30])).toBe(1);
  });
  it('clamps at the last index', () => {
    expect(advancePlayhead(2, [10, 20, 30])).toBe(2);
  });
  it('floors negative input to 0 then advances', () => {
    expect(advancePlayhead(-1, [10, 20, 30])).toBe(0);
  });
  it('returns 0 for empty list', () => {
    expect(advancePlayhead(0, [])).toBe(0);
  });
});

describe('computeIntervalMs', () => {
  it('returns 400 for 1×', () => {
    expect(computeIntervalMs(1)).toBe(TIMELINE_BASE_INTERVAL_MS);
  });
  it('returns 200 for 2×', () => {
    expect(computeIntervalMs(2)).toBe(200);
  });
  it('returns 100 for 4×', () => {
    expect(computeIntervalMs(4)).toBe(100);
  });
  it('falls back to 1× for zero or negative', () => {
    expect(computeIntervalMs(0)).toBe(TIMELINE_BASE_INTERVAL_MS);
    expect(computeIntervalMs(-1)).toBe(TIMELINE_BASE_INTERVAL_MS);
  });
});

describe('isPlayed', () => {
  it('treats seq before playhead as played', () => {
    expect(isPlayed(5, 10)).toBe(true);
  });
  it('treats seq AFTER playhead as not played', () => {
    expect(isPlayed(11, 10)).toBe(false);
  });
  it('treats equality as played (current position is saturated)', () => {
    expect(isPlayed(10, 10)).toBe(true);
  });
});
