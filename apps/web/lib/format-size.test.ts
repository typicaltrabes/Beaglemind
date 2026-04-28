import { describe, it, expect } from 'vitest';
import { formatSize } from './format-size';

describe('formatSize', () => {
  it('returns "0 B" for 0 bytes', () => {
    expect(formatSize(0)).toBe('0 B');
  });

  it('returns whole-byte values below 1 KB without unit conversion', () => {
    expect(formatSize(512)).toBe('512 B');
    expect(formatSize(1023)).toBe('1023 B');
  });

  it('returns KB with one decimal between 1 KB and 1 MB', () => {
    expect(formatSize(1024)).toBe('1.0 KB');
    expect(formatSize(2048)).toBe('2.0 KB');
    expect(formatSize(1024 * 1024 - 1)).toBe('1024.0 KB');
  });

  it('returns MB with one decimal at and above 1 MB', () => {
    expect(formatSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatSize(1572864)).toBe('1.5 MB');
    expect(formatSize(20 * 1024 * 1024)).toBe('20.0 MB');
  });
});
