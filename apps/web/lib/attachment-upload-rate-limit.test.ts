import { describe, it, expect, beforeEach } from 'vitest';
import {
  rateLimitOk,
  resetRateLimiterForTest,
} from './attachment-upload-rate-limit';

describe('attachment-upload-rate-limit', () => {
  beforeEach(() => {
    resetRateLimiterForTest();
  });

  it('allows the first 10 calls in a window', () => {
    for (let i = 0; i < 10; i++) {
      expect(rateLimitOk('user-1')).toBe(true);
    }
  });

  it('rejects the 11th call in a window', () => {
    for (let i = 0; i < 10; i++) {
      rateLimitOk('user-1');
    }
    expect(rateLimitOk('user-1')).toBe(false);
  });

  it('keeps separate counters per user', () => {
    for (let i = 0; i < 10; i++) {
      rateLimitOk('user-A');
    }
    expect(rateLimitOk('user-A')).toBe(false);
    // user-B is still fresh
    expect(rateLimitOk('user-B')).toBe(true);
  });

  it('resetRateLimiterForTest clears all state', () => {
    for (let i = 0; i < 10; i++) {
      rateLimitOk('user-A');
    }
    expect(rateLimitOk('user-A')).toBe(false);
    resetRateLimiterForTest();
    expect(rateLimitOk('user-A')).toBe(true);
  });
});
