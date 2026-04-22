import { describe, it, expect } from 'vitest';
import { getAgentColor } from './agent-colors';

describe('getAgentColor', () => {
  it("returns 'bg-amber-500' for 'mo'", () => {
    expect(getAgentColor('mo')).toBe('bg-amber-500');
  });

  it("returns 'bg-amber-500' for 'Mo' (case-insensitive)", () => {
    expect(getAgentColor('Mo')).toBe('bg-amber-500');
  });

  it("returns 'bg-teal-500' for 'jarvis'", () => {
    expect(getAgentColor('jarvis')).toBe('bg-teal-500');
  });

  it("returns 'bg-purple-400' for 'sentinel'", () => {
    expect(getAgentColor('sentinel')).toBe('bg-purple-400');
  });

  it("returns 'bg-blue-400' for 'user'", () => {
    expect(getAgentColor('user')).toBe('bg-blue-400');
  });

  it("returns 'bg-gray-500' for unknown agent id", () => {
    expect(getAgentColor('unknown')).toBe('bg-gray-500');
  });

  it("returns 'bg-gray-500' for empty string", () => {
    expect(getAgentColor('')).toBe('bg-gray-500');
  });
});
