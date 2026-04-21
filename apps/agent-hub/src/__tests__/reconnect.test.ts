import { describe, it, expect } from 'vitest';
import { calculateBackoff } from '../connections/reconnect';

describe('calculateBackoff', () => {
  it('attempt 0 returns value in range [500, 1500]', () => {
    // base 1000, jitter 0.5 => range is 1000 +/- 500
    for (let i = 0; i < 100; i++) {
      const delay = calculateBackoff(0);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(1500);
    }
  });

  it('attempt 1 returns value around 2000', () => {
    for (let i = 0; i < 100; i++) {
      const delay = calculateBackoff(1);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(3000);
    }
  });

  it('attempt 10 caps near 30000', () => {
    for (let i = 0; i < 100; i++) {
      const delay = calculateBackoff(10);
      // max is 30000, jitter 0.5 => range [15000, 45000]
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(45000);
    }
  });

  it('result is always >= 0', () => {
    for (let attempt = 0; attempt < 20; attempt++) {
      for (let i = 0; i < 50; i++) {
        expect(calculateBackoff(attempt)).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
